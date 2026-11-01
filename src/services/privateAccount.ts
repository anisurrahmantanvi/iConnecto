import { supabase } from '@/lib/supabase'
import { PROFILE_LITE } from '@/lib/api'
import type { ProfileLite } from '@/types/db'

/** All of these are written to keep working if the database has not been updated yet: reads return a safe default. */

export async function getIsPrivate(userId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('profiles').select('is_private').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return (data as { is_private: boolean }).is_private
}

export async function setMyPrivate(userId: string, on: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_private: on }).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function hasRequested(me: string, target: string): Promise<boolean> {
  const res = await supabase.from('follow_requests').select('target_id', { count: 'exact', head: true }).eq('requester_id', me).eq('target_id', target)
  return !res.error && (res.count ?? 0) > 0
}

/** Follows right away, or sends a request when the account is private. */
export async function requestFollow(target: string): Promise<'following' | 'requested'> {
  const { data, error } = await supabase.rpc('request_follow', { p_target: target })
  if (error) {
    // Database not updated yet: fall back to the plain follow.
    if (error.code === 'PGRST202' || error.code === '42883') {
      const ins = await supabase.from('followers').insert({ following_id: target })
      if (ins.error && ins.error.code !== '23505') throw new Error(ins.error.message)
      return 'following'
    }
    throw new Error(error.message)
  }
  return data === 'requested' ? 'requested' : 'following'
}

export async function cancelFollowRequest(target: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_follow_request', { p_target: target })
  if (error) throw new Error(error.message)
}

export async function countFollowRequests(me: string): Promise<number> {
  const res = await supabase.from('follow_requests').select('requester_id', { count: 'exact', head: true }).eq('target_id', me)
  return res.error ? 0 : (res.count ?? 0)
}

export interface FollowRequest { created_at: string; requester: ProfileLite }

export async function listFollowRequests(me: string): Promise<FollowRequest[]> {
  const { data, error } = await supabase
    .from('follow_requests')
    .select(`created_at, requester:profiles!requester_id(${PROFILE_LITE})`)
    .eq('target_id', me)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data as unknown as { created_at: string; requester: ProfileLite | null }[])
    .filter((r): r is FollowRequest => !!r.requester)
}

export async function respondFollowRequest(requester: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_follow_request', { p_requester: requester, p_accept: accept })
  if (error) throw new Error(error.message)
}
