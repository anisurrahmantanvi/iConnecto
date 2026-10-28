import { supabase } from '@/lib/supabase'
import { check, isDuplicate, PROFILE_LITE } from '@/lib/api'
import type { Comment, CommentView } from '@/types/db'

const COMMENT_SELECT =
  `id, post_id, author_id, parent_id, content, like_count, reply_count, created_at, updated_at, edited_at, author:profiles!author_id(${PROFILE_LITE})`

export const COMMENT_PAGE = 20
export const MAX_COMMENT_LENGTH = 2000

async function hydrate(comments: Comment[], userId: string): Promise<CommentView[]> {
  if (!comments.length) return []
  const ids = comments.map((c) => c.id)
  const rows = check(await supabase.from('comment_likes').select('comment_id').eq('user_id', userId).in('comment_id', ids)) as { comment_id: string }[]
  const liked = new Set(rows.map((r) => r.comment_id))
  return comments.map((c) => ({ ...c, liked: liked.has(c.id) }))
}

export async function fetchComments(userId: string, postId: string, cursor: string | null) {
  let q = supabase
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .limit(COMMENT_PAGE)
  if (cursor) q = q.gt('created_at', cursor)
  const raw = check(await q) as unknown as Comment[]
  return {
    items: await hydrate(raw, userId),
    nextCursor: raw.length === COMMENT_PAGE ? raw[raw.length - 1].created_at : null,
  }
}

export async function fetchReplies(userId: string, parentId: string): Promise<CommentView[]> {
  const raw = check(
    await supabase.from('comments').select(COMMENT_SELECT).eq('parent_id', parentId).order('created_at', { ascending: true }).limit(100),
  ) as unknown as Comment[]
  return hydrate(raw, userId)
}

export async function addComment(userId: string, input: { postId: string; content: string; parentId?: string | null }): Promise<CommentView> {
  const content = input.content.trim()
  if (!content) throw new Error('Write a comment first.')
  if (content.length > MAX_COMMENT_LENGTH) throw new Error(`Comments can be up to ${MAX_COMMENT_LENGTH} characters.`)
  const res = await supabase
    .from('comments')
    .insert({ post_id: input.postId, content, parent_id: input.parentId ?? null })
    .select(COMMENT_SELECT)
    .single()
  const row = check(res) as unknown as Comment
  return { ...row, liked: false }
}

export async function editComment(id: string, content: string): Promise<void> {
  const text = content.trim()
  if (!text) throw new Error('A comment cannot be empty.')
  check(await supabase.from('comments').update({ content: text }).eq('id', id).select('id').single())
}

export async function removeComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setCommentLike(commentId: string, userId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId })
    if (error && !isDuplicate(error)) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId)
    if (error) throw new Error(error.message)
  }
}
