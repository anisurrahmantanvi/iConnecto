import { supabase, channelName } from '@/lib/supabase'
import { check, PAGE_SIZE, PROFILE_LITE } from '@/lib/api'
import type { AppNotification, Page } from '@/types/db'

const SELECT = `id, recipient_id, actor_id, type, post_id, comment_id, community_id, is_read, created_at, actor:profiles!actor_id(${PROFILE_LITE})`

export async function fetchNotifications(cursor: string | null): Promise<Page<AppNotification>> {
  let q = supabase.from('notifications').select(SELECT).order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  const items = check(await q) as unknown as AppNotification[]
  return { items, nextCursor: items.length === PAGE_SIZE ? items[items.length - 1].created_at : null }
}

export async function unreadNotificationCount(): Promise<number> {
  const res = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
  if (res.error) throw new Error(res.error.message)
  return res.count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', userId).eq('is_read', false)
  if (error) throw new Error(error.message)
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Subscribes to new notifications for this user. Returns an unsubscribe function. */
export function subscribeNotifications(userId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(channelName(`notifications:${userId}`))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, () => onInsert())
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
