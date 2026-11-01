import { supabase } from '@/lib/supabase'
import { PROFILE_LITE, check } from '@/lib/api'
import type { Page, ProfileLite } from '@/types/db'

/** Friends: request, accept, unfriend. The rules live in the database (migration 0022). */
export type FriendState = 'none' | 'friends' | 'requested' | 'incoming'

const PAGE_SIZE = 30

/** The state between me and each given person, in three queries for a whole list. */
export async function friendStatesAmong(me: string, ids: string[]): Promise<Map<string, FriendState>> {
  const out = new Map<string, FriendState>()
  if (!ids.length) return out
  const [fr, sent, got] = await Promise.all([
    supabase.from('friendships').select('friend_id').eq('user_id', me).in('friend_id', ids),
    supabase.from('friend_requests').select('target_id').eq('requester_id', me).in('target_id', ids),
    supabase.from('friend_requests').select('requester_id').eq('target_id', me).in('requester_id', ids),
  ])
  for (const r of (got.data ?? []) as { requester_id: string }[]) out.set(r.requester_id, 'incoming')
  for (const r of (sent.data ?? []) as { target_id: string }[]) out.set(r.target_id, 'requested')
  for (const r of (fr.data ?? []) as { friend_id: string }[]) out.set(r.friend_id, 'friends')
  return out
}

export async function getFriendState(me: string, other: string): Promise<FriendState> {
  return (await friendStatesAmong(me, [other])).get(other) ?? 'none'
}

export async function sendFriendRequest(target: string): Promise<'friends' | 'requested'> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_target: target })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('Friends are not available yet. The database update has not been run.')
    throw new Error(error.message)
  }
  return data === 'friends' ? 'friends' : 'requested'
}

export async function cancelFriendRequest(target: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_friend_request', { p_target: target })
  if (error) throw new Error(error.message)
}

export async function respondFriendRequest(requester: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_friend_request', { p_requester: requester, p_accept: accept })
  if (error) throw new Error(error.message)
}

export async function unfriend(other: string): Promise<void> {
  const { error } = await supabase.rpc('unfriend', { p_other: other })
  if (error) throw new Error(error.message)
}

/** Null when the database has not been updated yet. */
export async function countFriends(userId: string): Promise<number | null> {
  const res = await supabase.from('friendships').select('friend_id', { count: 'exact', head: true }).eq('user_id', userId)
  return res.error ? null : (res.count ?? 0)
}

export async function listFriends(userId: string, cursor: string | null): Promise<Page<ProfileLite>> {
  let q = supabase
    .from('friendships')
    .select(`created_at, profile:profiles!friend_id(${PROFILE_LITE})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  const rows = check(await q) as unknown as { created_at: string; profile: ProfileLite | null }[]
  return {
    items: rows.map((r) => r.profile).filter((p): p is ProfileLite => !!p),
    nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
  }
}

export async function countFriendRequests(me: string): Promise<number> {
  const res = await supabase.from('friend_requests').select('requester_id', { count: 'exact', head: true }).eq('target_id', me)
  return res.error ? 0 : (res.count ?? 0)
}

export interface FriendRequest { created_at: string; requester: ProfileLite }

export async function listFriendRequests(me: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`created_at, requester:profiles!requester_id(${PROFILE_LITE})`)
    .eq('target_id', me)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data as unknown as { created_at: string; requester: ProfileLite | null }[]).filter((r): r is FriendRequest => !!r.requester)
}
