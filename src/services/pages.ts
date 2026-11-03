import { supabase } from '@/lib/supabase'
import { check, isDuplicate, PAGE_SIZE, PROFILE_LITE } from '@/lib/api'
import type { Page, Post, PostView, ProfileLite } from '@/types/db'
import { hydratePosts, POST_SELECT } from './posts'
import { uploadImage } from './storage'

export const PAGE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'creator', label: 'Creator / Public figure' },
  { id: 'business', label: 'Business / Brand' },
  { id: 'community', label: 'Community / Organization' },
  { id: 'media', label: 'News / Media' },
]
const LEGACY: Record<string, string> = { brand: 'Brand', shop: 'Shop', public_figure: 'Public figure', education: 'Education', other: 'Page' }
export const categoryLabel = (id: string) => PAGE_CATEGORIES.find((c) => c.id === id)?.label ?? LEGACY[id] ?? 'Page'

export type PageRole = 'owner' | 'admin' | 'editor'
export interface PageRow {
  id: string
  slug: string
  name: string
  category: string
  bio: string
  website: string | null
  avatar_url: string | null
  cover_url: string | null
  owner_id: string
  follower_count: number
  created_at: string
}
const COLS = 'id, slug, name, category, bio, website, avatar_url, cover_url, owner_id, follower_count, created_at'

function missing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' || /could not find the (table|function)|does not exist|schema cache/i.test(err.message ?? '')
}

/** Pages I own or work on. null = the Pages tables are not installed yet. */
export async function listMyPages(userId: string): Promise<{ page: PageRow; role: PageRole }[] | null> {
  const res = await supabase.from('page_roles').select(`role, page:pages(${COLS})`).eq('user_id', userId).order('created_at', { ascending: false })
  if (missing(res.error)) return null
  const rows = check(res) as unknown as { role: PageRole; page: PageRow | null }[]
  return rows.filter((r) => r.page).map((r) => ({ role: r.role, page: r.page as PageRow }))
}

export async function listDiscoverPages(query: string): Promise<PageRow[] | null> {
  const q = query.trim().replace(/[%_,()]/g, ' ').slice(0, 40)
  let req = supabase.from('pages').select(COLS).order('follower_count', { ascending: false }).order('created_at', { ascending: false }).limit(30)
  if (q.length >= 2) req = req.or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
  const res = await req
  if (missing(res.error)) return null
  return check(res) as unknown as PageRow[]
}

export async function getPageBySlug(slug: string): Promise<PageRow | null> {
  const res = await supabase.from('pages').select(COLS).eq('slug', slug.toLowerCase()).maybeSingle()
  if (missing(res.error)) return null
  return check(res) as unknown as PageRow | null
}

export async function myPageRole(pageId: string, userId: string): Promise<PageRole | null> {
  const res = await supabase.from('page_roles').select('role').eq('page_id', pageId).eq('user_id', userId).maybeSingle()
  if (res.error) return null
  return ((res.data as { role: PageRole } | null)?.role) ?? null
}

export function cleanSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30)
}

export async function createPage(input: { slug: string; name: string; category: string; bio: string }): Promise<string> {
  const res = await supabase.rpc('create_page', { p_slug: input.slug, p_name: input.name, p_category: input.category, p_bio: input.bio })
  if (missing(res.error)) throw new Error('Pages will be available after the next database update.')
  return check(res) as unknown as string
}

export async function updatePage(id: string, patch: Partial<Pick<PageRow, 'name' | 'category' | 'bio' | 'website' | 'avatar_url' | 'cover_url'>>): Promise<void> {
  check(await supabase.from('pages').update(patch).eq('id', id).select('id').single())
}

export const uploadPageImage = (kind: 'avatar' | 'cover', userId: string, file: File) =>
  uploadImage(kind === 'avatar' ? 'avatars' : 'covers', userId, file)

export async function deletePage(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_page', { p_page: id })
  if (error) throw new Error(error.message)
}

export async function isFollowingPage(pageId: string, userId: string): Promise<boolean> {
  const res = await supabase.from('page_follows').select('page_id', { count: 'exact', head: true }).eq('page_id', pageId).eq('user_id', userId)
  if (res.error) return false
  return (res.count ?? 0) > 0
}
export async function followPage(pageId: string): Promise<void> {
  const { error } = await supabase.from('page_follows').insert({ page_id: pageId })
  if (error && !isDuplicate(error)) throw new Error(error.message)
}
export async function unfollowPage(pageId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('page_follows').delete().eq('page_id', pageId).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export interface TeamMember { role: PageRole; profile: ProfileLite }
export async function listTeam(pageId: string): Promise<TeamMember[]> {
  const res = await supabase.from('page_roles').select(`role, profile:profiles!user_id(${PROFILE_LITE})`).eq('page_id', pageId).order('created_at')
  const rows = check(res) as unknown as { role: PageRole; profile: ProfileLite | null }[]
  return rows.filter((r) => r.profile).map((r) => ({ role: r.role, profile: r.profile as ProfileLite }))
}
export async function setPageRole(pageId: string, username: string, role: 'admin' | 'editor'): Promise<void> {
  const { error } = await supabase.rpc('set_page_role', { p_page: pageId, p_username: username.replace(/^@/, ''), p_role: role })
  if (error) throw new Error(error.message)
}
export async function removePageRole(pageId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_page_role', { p_page: pageId, p_user: userId })
  if (error) throw new Error(error.message)
}

export async function linkPagePost(postId: string, pageId: string): Promise<void> {
  const { error } = await supabase.rpc('link_page_post', { p_post: postId, p_page: pageId })
  if (error) throw new Error(error.message)
}

export async function fetchPagePosts(userId: string, pageId: string, cursor: string | null): Promise<Page<PostView>> {
  let q = supabase
    .from('page_posts')
    .select(`created_at, post:posts(${POST_SELECT})`)
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  const rows = check(await q) as unknown as { created_at: string; post: Post | null }[]
  const items = await hydratePosts(rows.map((r) => r.post).filter((p): p is Post => !!p), userId)
  return { items, nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null }
}

export interface PageInsights {
  followers: number; followers_7d: number; followers_30d: number
  posts: number; posts_30d: number; likes: number; comments: number
  top_post: { id: string; content: string; likes: number; comments: number } | null
}
export async function getPageInsights(pageId: string): Promise<PageInsights | null> {
  const { data, error } = await supabase.rpc('page_insights', { p_page: pageId })
  if (error) return null
  return data as unknown as PageInsights
}
