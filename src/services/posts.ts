import { supabase } from '@/lib/supabase'
import { check, isDuplicate, PAGE_SIZE, PROFILE_LITE } from '@/lib/api'
import { sanitizeSearch } from '@/lib/format'
import type { Page, Post, PostView, ReactionSummary } from '@/types/db'
import { removeImages, uploadImage } from './storage'

export const POST_SELECT =
  `id, author_id, content, media_urls, community_id, like_count, comment_count, share_count, created_at, updated_at, edited_at, author:profiles!author_id(${PROFILE_LITE}), community:communities!community_id(slug, name)`

export const MAX_POST_IMAGES = 4
export const MAX_POST_LENGTH = 5000

/** Adds the viewer-specific state (liked / saved / emoji reactions) for a page of posts in 3 queries. */
export async function hydratePosts(posts: Post[], userId: string): Promise<PostView[]> {
  if (!posts.length) return []
  const ids = posts.map((p) => p.id)
  const [likes, saves, reacts] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', ids),
    supabase.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids),
    supabase.rpc('post_reaction_summary', { p_post_ids: ids }),
  ])
  const liked = new Set((check(likes) as { post_id: string }[]).map((r) => r.post_id))
  const saved = new Set((check(saves) as { post_id: string }[]).map((r) => r.post_id))
  const byPost = new Map<string, ReactionSummary[]>()
  // A failed reaction lookup should not break the feed; degrade to "no reactions".
  const reactRows = (reacts.error ? [] : reacts.data ?? []) as { post_id: string; emoji: string; reaction_count: number; reacted: boolean }[]
  for (const r of reactRows) {
    const list = byPost.get(r.post_id) ?? []
    list.push({ emoji: r.emoji, count: Number(r.reaction_count), reacted: r.reacted })
    byPost.set(r.post_id, list)
  }
  return posts.map((p) => ({ ...p, liked: liked.has(p.id), saved: saved.has(p.id), reactions: byPost.get(p.id) ?? [] }))
}

function page(items: PostView[]): Page<PostView> {
  return { items, nextCursor: items.length === PAGE_SIZE ? items[items.length - 1].created_at : null }
}

export async function fetchFeed(userId: string, mode: 'all' | 'following', cursor: string | null): Promise<Page<PostView>> {
  let posts: Post[]
  if (mode === 'following') {
    // Server-side filter (migration 0008): avoids sending hundreds of ids in the URL.
    const res = await supabase.rpc('home_feed', { p_before: cursor, p_limit: PAGE_SIZE }).select(POST_SELECT)
    posts = check(res) as unknown as Post[]
  } else {
    let q = supabase.from('posts').select(POST_SELECT).is('community_id', null).order('created_at', { ascending: false }).limit(PAGE_SIZE)
    if (cursor) q = q.lt('created_at', cursor)
    posts = check(await q) as unknown as Post[]
  }
  return page(await hydratePosts(posts, userId))
}

export async function fetchUserPosts(userId: string, authorId: string, cursor: string | null): Promise<Page<PostView>> {
  let q = supabase.from('posts').select(POST_SELECT).eq('author_id', authorId).order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  return page(await hydratePosts(check(await q) as unknown as Post[], userId))
}

export async function fetchCommunityPosts(userId: string, communityId: string, cursor: string | null): Promise<Page<PostView>> {
  let q = supabase.from('posts').select(POST_SELECT).eq('community_id', communityId).order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  return page(await hydratePosts(check(await q) as unknown as Post[], userId))
}

export async function fetchPost(userId: string, id: string): Promise<PostView | null> {
  const res = await supabase.from('posts').select(POST_SELECT).eq('id', id).maybeSingle()
  const post = check(res) as unknown as Post | null
  if (!post) return null
  return (await hydratePosts([post], userId))[0]
}

export async function searchPosts(userId: string, query: string, cursor: string | null): Promise<Page<PostView>> {
  const q = sanitizeSearch(query)
  if (q.length < 2) return { items: [], nextCursor: null }
  let req = supabase.from('posts').select(POST_SELECT).is('community_id', null).ilike('content', `%${q}%`).order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (cursor) req = req.lt('created_at', cursor)
  return page(await hydratePosts(check(await req) as unknown as Post[], userId))
}

/** Latest public posts that have images, for the Discover grid. */
export async function discoverPosts(userId: string, cursor: string | null): Promise<Page<PostView>> {
  let req = supabase.from('posts').select(POST_SELECT).is('community_id', null).order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (cursor) req = req.lt('created_at', cursor)
  return page(await hydratePosts(check(await req) as unknown as Post[], userId))
}

export async function fetchSavedPosts(userId: string, cursor: string | null): Promise<Page<PostView>> {
  let q = supabase
    .from('saved_posts')
    .select(`created_at, post:posts(${POST_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  const rows = check(await q) as unknown as { created_at: string; post: Post | null }[]
  const posts = rows.map((r) => r.post).filter((p): p is Post => !!p)
  const items = await hydratePosts(posts, userId)
  return { items, nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null }
}

export interface NewPost {
  content: string
  files: File[]
  communityId?: string | null
}

export async function createPost(userId: string, input: NewPost): Promise<string> {
  const content = input.content.trim()
  if (!content && !input.files.length) throw new Error('Write something or add a photo.')
  if (content.length > MAX_POST_LENGTH) throw new Error(`Posts can be up to ${MAX_POST_LENGTH} characters.`)
  if (input.files.length > MAX_POST_IMAGES) throw new Error(`You can attach up to ${MAX_POST_IMAGES} photos.`)

  const uploaded: string[] = []
  try {
    for (const file of input.files) uploaded.push(await uploadImage('post-media', userId, file))
    // author_id comes from the session; counters are server-owned.
    const res = await supabase
      .from('posts')
      .insert({ content, media_urls: uploaded, community_id: input.communityId ?? null })
      .select('id')
      .single()
    return (check(res) as { id: string }).id
  } catch (e) {
    if (uploaded.length) void removeImages('post-media', uploaded)
    throw e
  }
}

export async function updatePost(id: string, content: string): Promise<void> {
  const text = content.trim()
  if (text.length > MAX_POST_LENGTH) throw new Error(`Posts can be up to ${MAX_POST_LENGTH} characters.`)
  check(await supabase.from('posts').update({ content: text }).eq('id', id).select('id').single())
}

export async function deletePost(post: Pick<Post, 'id' | 'media_urls'>): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', post.id)
  if (error) throw new Error(error.message)
  if (post.media_urls.length) void removeImages('post-media', post.media_urls)
}

export async function setLike(postId: string, userId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId })
    if (error && !isDuplicate(error)) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
    if (error) throw new Error(error.message)
  }
}

export async function setSaved(postId: string, userId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase.from('saved_posts').insert({ post_id: postId })
    if (error && !isDuplicate(error)) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', userId)
    if (error) throw new Error(error.message)
  }
}

export async function recordShare(postId: string): Promise<void> {
  const { error } = await supabase.from('shares').insert({ post_id: postId })
  if (error && !isDuplicate(error)) throw new Error(error.message)
}

export async function setReaction(postId: string, userId: string, emoji: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase.from('post_reactions').insert({ post_id: postId, emoji })
    if (error && !isDuplicate(error)) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId).eq('emoji', emoji)
    if (error) throw new Error(error.message)
  }
}
