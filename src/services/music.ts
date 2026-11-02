import { supabase } from '@/lib/supabase'

export interface PostAudio { post_id: string; audio_url: string; title: string; artist: string | null; source: 'upload' | 'library' }
export interface MusicTrack { id: string; title: string; artist: string | null; language: string | null; license: string; source_url: string | null; audio_url: string }
export interface AudioDraft { audio_url: string; title: string; artist: string | null; source: 'upload' | 'library'; uploadedPath?: string }

export const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const OK_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a']

export function validateAudio(file: File): string | null {
  if (!OK_TYPES.includes(file.type) && !/\.(mp3|m4a|aac|ogg|wav)$/i.test(file.name)) return 'Choose an MP3, M4A, AAC, OGG or WAV file.'
  if (file.size > MAX_AUDIO_BYTES) return 'Audio can be up to 8 MB.'
  return null
}

export async function uploadAudio(userId: string, file: File): Promise<AudioDraft> {
  const problem = validateAudio(file)
  if (problem) throw new Error(problem)
  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp3'
  const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const type = OK_TYPES.includes(file.type) ? file.type : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg'
  const { error } = await supabase.storage.from('post-audio').upload(path, file, { contentType: type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(/bucket not found/i.test(error.message) ? 'Music uploads need a database update first.' : error.message)
  const title = file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Original audio'
  return { audio_url: supabase.storage.from('post-audio').getPublicUrl(path).data.publicUrl, title, artist: null, source: 'upload', uploadedPath: path }
}

export async function attachPostAudio(postId: string, a: AudioDraft): Promise<void> {
  const { error } = await supabase.from('post_audio').insert({ post_id: postId, audio_url: a.audio_url, title: a.title, artist: a.artist, source: a.source })
  if (error) throw new Error(error.message)
}

export async function removeUploadedAudio(a: AudioDraft): Promise<void> {
  if (!a.uploadedPath) return
  try { await supabase.storage.from('post-audio').remove([a.uploadedPath]) } catch { /* ignore */ }
}

/** Never throws: before the database update there is simply no music. */
export async function fetchPostAudio(postIds: string[]): Promise<Map<string, PostAudio>> {
  const map = new Map<string, PostAudio>()
  if (!postIds.length) return map
  try {
    const { data, error } = await supabase.from('post_audio').select('*').in('post_id', postIds)
    if (error || !data) return map
    for (const r of data as PostAudio[]) map.set(r.post_id, r)
  } catch { /* ignore */ }
  return map
}

export async function listLibrary(): Promise<MusicTrack[]> {
  const { data, error } = await supabase.from('music_tracks').select('*').order('created_at', { ascending: false }).limit(200)
  if (error || !data) return []
  return data as MusicTrack[]
}
