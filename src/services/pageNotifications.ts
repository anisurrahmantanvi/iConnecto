import { supabase } from '@/lib/supabase'
import { PROFILE_LITE } from '@/lib/api'

export interface PageNotification {
  id: string
  type: 'follow' | 'like' | 'comment'
  post_id: string | null
  is_read: boolean
  created_at: string
  actor: { id: string; username: string; display_name: string | null; avatar_url: string | null; badge?: string | null } | null
}

function missing(err: { message?: string; code?: string } | null): boolean {
  return !!err && (err.code === 'PGRST205' || err.code === '42P01' || /could not find the table|does not exist|schema cache/i.test(err.message ?? ''))
}

/** null = the database has not been updated yet. */
export async function listPageNotifications(pageId: string): Promise<PageNotification[] | null> {
  const res = await supabase.from('page_notifications').select(`id, type, post_id, is_read, created_at, actor:profiles!actor_id(${PROFILE_LITE})`)
    .eq('page_id', pageId).order('created_at', { ascending: false }).limit(60)
  if (missing(res.error)) return null
  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []) as unknown as PageNotification[]
}

export async function pageUnreadCount(pageId: string): Promise<number> {
  const res = await supabase.from('page_notifications').select('id', { count: 'exact', head: true }).eq('page_id', pageId).eq('is_read', false)
  if (res.error) return 0
  return res.count ?? 0
}

export async function markPageNotificationsRead(pageId: string): Promise<void> {
  await supabase.from('page_notifications').update({ is_read: true }).eq('page_id', pageId).eq('is_read', false)
}
