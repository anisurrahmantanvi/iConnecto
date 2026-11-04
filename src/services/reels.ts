import { supabase } from '@/lib/supabase'
import { check, PAGE_SIZE, PROFILE_LITE } from '@/lib/api'
import type { Page, ProfileLite } from '@/types/db'

export const MAX_REEL_BYTES = 25 * 1024 * 1024
export const MAX_REEL_SECONDS = 60
const TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export interface Reel {
  id: string
  author_id: string
  video_url: string
  caption: string
  duration_s: number | null
  like_count: number
  comment_count: number
  view_count: number
  created_at: string
  author: ProfileLite | null
  liked: boolean
}
export interface ReelComment { id: string; content: string; created_at: string; author_id: string; author: ProfileLite | null }

const COLS = `id, author_id, video_url, caption, duration_s, like_count, comment_count, view_count, created_at, author:profiles!author_id(${PROFILE_LITE})`

function missing(err: { message?: string; code?: string } | null): boolean {
  return !!err && (err.code === 'PGRST205' || err.code === '42P01' || /could not find the (table|function)|does not exist|schema cache/i.test(err.message ?? ''))
}
export const NOT_READY = 'Reels will be available after the next database update.'

/** One page of reels, newest first. Throws NOT_READY before the database update. */
export async function fetchReels(userId: string, cursor: string | null): Promise<Page<Reel>> {
  let q = supabase.from('reels').select(COLS).order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  const res = await q
  if (missing(res.error)) throw new Error(NOT_READY)
  const rows = check(res) as unknown as Omit<Reel, 'liked'>[]
  let liked = new Set<string>()
  if (rows.length) {
    const l = await supabase.from('reel_likes').select('reel_id').eq('user_id', userId).in('reel_id', rows.map((r) => r.id))
    liked = new Set(((l.data ?? []) as { reel_id: string }[]).map((r) => r.reel_id))
  }
  const items = rows.map((r) => ({ ...r, liked: liked.has(r.id) }))
  return { items, nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null }
}

export function validateVideo(file: File): string | null {
  if (!TYPES.includes(file.type)) return 'Choose an MP4, WebM or MOV video.'
  if (file.size > MAX_REEL_BYTES) return `Video is too large. Maximum is ${Math.round(MAX_REEL_BYTES / 1048576)} MB.`
  return null
}

/** Reads the length of a video file in the browser. */
export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration) }
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This video could not be read.')) }
    v.src = url
  })
}

export async function createReel(userId: string, file: File, caption: string): Promise<string> {
  const bad = validateVideo(file)
  if (bad) throw new Error(bad)
  const seconds = await videoDuration(file).catch(() => 0)
  if (seconds > MAX_REEL_SECONDS + 1) throw new Error(`Reels can be up to ${MAX_REEL_SECONDS} seconds.`)
  const ext = file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4'
  const path = `${userId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`
  const up = await supabase.storage.from('reel-videos').upload(path, file, { contentType: file.type, upsert: false })
  if (up.error) throw new Error(/bucket not found/i.test(up.error.message) ? NOT_READY : up.error.message)
  const url = supabase.storage.from('reel-videos').getPublicUrl(path).data.publicUrl
  const res = await supabase.from('reels').insert({ video_url: url, caption: caption.trim(), duration_s: seconds ? Math.max(1, Math.min(90, Math.round(seconds))) : null }).select('id').single()
  if (res.error) {
    void supabase.storage.from('reel-videos').remove([path])
    throw new Error(missing(res.error) ? NOT_READY : res.error.message)
  }
  return (res.data as { id: string }).id
}

export async function deleteReel(reel: Reel): Promise<void> {
  const { error } = await supabase.from('reels').delete().eq('id', reel.id)
  if (error) throw new Error(error.message)
  const m = reel.video_url.match(/\/reel-videos\/(.+)$/)
  if (m) void supabase.storage.from('reel-videos').remove([decodeURIComponent(m[1])])
}

export async function setReelLike(reelId: string, userId: string, on: boolean): Promise<void> {
  const { error } = on
    ? await supabase.from('reel_likes').insert({ reel_id: reelId })
    : await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', userId)
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function listReelComments(reelId: string): Promise<ReelComment[]> {
  const res = await supabase.from('reel_comments').select(`id, content, created_at, author_id, author:profiles!author_id(${PROFILE_LITE})`).eq('reel_id', reelId).order('created_at').limit(200)
  return check(res) as unknown as ReelComment[]
}
export async function addReelComment(reelId: string, content: string): Promise<void> {
  const { error } = await supabase.from('reel_comments').insert({ reel_id: reelId, content: content.trim() })
  if (error) throw new Error(error.message)
}
export async function deleteReelComment(id: string): Promise<void> {
  const { error } = await supabase.from('reel_comments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function countView(reelId: string): void {
  void supabase.rpc('reel_view', { p_reel: reelId }).then(() => undefined, () => undefined)
}

/** A few reels for a strip (home or a profile). Empty list when reels are not installed or none exist. */
export async function fetchReelStrip(authorId: string | null, limit = 10): Promise<Pick<Reel, 'id' | 'video_url' | 'caption' | 'view_count'>[]> {
  try {
    let q = supabase.from('reels').select('id, video_url, caption, view_count').order('created_at', { ascending: false }).limit(limit)
    if (authorId) q = q.eq('author_id', authorId)
    const { data, error } = await q
    return error ? [] : ((data ?? []) as Pick<Reel, 'id' | 'video_url' | 'caption' | 'view_count'>[])
  } catch { return [] }
}

export async function fetchReel(userId: string, id: string): Promise<Reel | null> {
  const res = await supabase.from('reels').select(COLS).eq('id', id).maybeSingle()
  if (missing(res.error)) throw new Error(NOT_READY)
  const row = check(res) as unknown as Omit<Reel, 'liked'> | null
  if (!row) return null
  const l = await supabase.from('reel_likes').select('reel_id').eq('user_id', userId).eq('reel_id', id).maybeSingle()
  return { ...row, liked: !!l.data }
}
