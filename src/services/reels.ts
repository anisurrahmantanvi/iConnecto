import { supabase } from '@/lib/supabase'
import type { Reel } from '@/types/db'

const COLUMNS = 'id, video_id, tiktok_url, title, author_name, thumbnail_url, created_at'

/** Accepts a full tiktok.com video link. Short links (vm.tiktok.com) cannot be resolved without a server, so they are refused. */
export function parseTikTokUrl(input: string): { videoId: string; url: string } {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    throw new Error('That does not look like a link.')
  }
  const host = u.hostname.toLowerCase()
  const isTikTok = host === 'tiktok.com' || host.endsWith('.tiktok.com')
  if (!isTikTok || host.startsWith('vm.') || host.startsWith('vt.')) {
    throw new Error('Paste the full video link: open the video in a browser and copy the address (tiktok.com/@name/video/123…). Short links do not work.')
  }
  const m = u.pathname.match(/^\/@([^/]+)\/video\/(\d{5,25})/)
  if (!m) throw new Error('Paste the full video link (tiktok.com/@name/video/123…).')
  return { videoId: m[2], url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}` }
}

interface OEmbed {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

/** Best effort: the browser may refuse this cross-site request. The reel works without the extra details. */
async function fetchOEmbed(url: string): Promise<OEmbed | null> {
  try {
    const ctrl = new AbortController()
    const t = window.setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: ctrl.signal })
    window.clearTimeout(t)
    if (!res.ok) return null
    return (await res.json()) as OEmbed
  } catch {
    return null
  }
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return data === true
}

export async function listReels(): Promise<Reel[]> {
  const { data, error } = await supabase.from('reels').select(COLUMNS).order('created_at', { ascending: false }).limit(60)
  if (error) throw new Error(error.message)
  return (data ?? []) as Reel[]
}

export async function addReel(input: string): Promise<Reel> {
  const { videoId, url } = parseTikTokUrl(input)
  const meta = await fetchOEmbed(url)
  const thumb = meta?.thumbnail_url && meta.thumbnail_url.startsWith('https://') ? meta.thumbnail_url : null
  const { data, error } = await supabase
    .from('reels')
    .insert({
      video_id: videoId,
      tiktok_url: url,
      title: meta?.title ? meta.title.slice(0, 300) : null,
      author_name: meta?.author_name ? meta.author_name.slice(0, 100) : null,
      thumbnail_url: thumb,
    })
    .select(COLUMNS)
    .single()
  if (error) {
    if (/duplicate key/i.test(error.message)) throw new Error('This video is already in Reels.')
    if (/row-level security|permission denied/i.test(error.message)) throw new Error('Only an admin can add reels.')
    throw new Error(error.message)
  }
  return data as Reel
}

export async function deleteReel(id: string): Promise<void> {
  const { error } = await supabase.from('reels').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
