import { supabase } from '@/lib/supabase'

function missing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' || /could not find the (table|function)|does not exist|schema cache/i.test(err.message ?? '')
}
export const NOT_INSTALLED = 'This will be available after the next database update.'

export interface NotifPrefs {
  push_messages: boolean; push_calls: boolean; push_likes: boolean; push_comments: boolean; push_social: boolean
  quiet_enabled: boolean; quiet_start: number; quiet_end: number; tz_offset: number; paused_until: string | null
}
export const DEFAULT_PREFS: NotifPrefs = {
  push_messages: true, push_calls: true, push_likes: true, push_comments: true, push_social: true,
  quiet_enabled: false, quiet_start: 1380, quiet_end: 420, tz_offset: 0, paused_until: null,
}

/** null = the table is not installed yet. */
export async function getNotifPrefs(userId: string): Promise<NotifPrefs | null> {
  const res = await supabase.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle()
  if (missing(res.error)) return null
  if (res.error) throw new Error(res.error.message)
  return { ...DEFAULT_PREFS, ...((res.data as Partial<NotifPrefs> | null) ?? {}) }
}

export async function saveNotifPrefs(userId: string, patch: Partial<NotifPrefs>): Promise<void> {
  const row = { user_id: userId, ...patch, tz_offset: -new Date().getTimezoneOffset(), updated_at: new Date().toISOString() }
  const { error } = await supabase.from('notification_prefs').upsert(row, { onConflict: 'user_id' })
  if (missing(error)) throw new Error(NOT_INSTALLED)
  if (error) throw new Error(error.message)
}

export type SupportKind = 'problem' | 'bug' | 'feature' | 'support'
export async function sendSupportRequest(kind: SupportKind, message: string): Promise<void> {
  const app_info = `${navigator.userAgent}`.slice(0, 480)
  const { error } = await supabase.from('support_requests').insert({ kind, message: message.trim(), app_info })
  if (missing(error)) throw new Error(NOT_INSTALLED)
  if (error) throw new Error(/row-level security/i.test(error.message) ? 'You have sent a few messages already. Please try again in an hour.' : error.message)
}

/** Everything that belongs to this person and that they can already read, as one JSON object. Messages are not included. */
export async function collectMyData(userId: string): Promise<Record<string, unknown>> {
  const q = async (table: string, col: string, cols = '*') => {
    const r = await supabase.from(table).select(cols).eq(col, userId).limit(5000)
    return r.error ? { error: r.error.message } : r.data
  }
  const [profile, posts, comments, likes, saved, friends] = await Promise.all([
    q('profiles', 'id'),
    q('posts', 'author_id', 'id, content, media_urls, visibility, like_count, comment_count, created_at'),
    q('comments', 'author_id', 'id, post_id, parent_id, content, created_at'),
    q('post_likes', 'user_id', 'post_id, created_at'),
    q('saved_posts', 'user_id', 'post_id, created_at'),
    q('friendships', 'user_id', 'friend_id, created_at'),
  ])
  return { exported_at: new Date().toISOString(), note: 'Messages and other people\'s data are not included.', profile, posts, comments, likes, saved_posts: saved, friends }
}
