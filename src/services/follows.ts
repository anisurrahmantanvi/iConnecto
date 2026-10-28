import { supabase } from '@/lib/supabase'
import { check, isDuplicate, PAGE_SIZE, PROFILE_LITE } from '@/lib/api'
import type { Page, ProfileLite } from '@/types/db'

export async function isFollowing(me: string, target: string): Promise<boolean> {
  const res = await supabase
    .from('followers')
    .select('follower_id', { count: 'exact', head: true })
    .eq('follower_id', me)
    .eq('following_id', target)
  if (res.error) throw new Error(res.error.message)
  return (res.count ?? 0) > 0
}

export async function followUser(target: string): Promise<void> {
  // follower_id is filled from the session (column default auth.uid()) and re-checked by RLS.
  const { error } = await supabase.from('followers').insert({ following_id: target })
  if (error && !isDuplicate(error)) throw new Error(error.message)
}

export async function unfollowUser(me: string, target: string): Promise<void> {
  const { error } = await supabase.from('followers').delete().eq('follower_id', me).eq('following_id', target)
  if (error) throw new Error(error.message)
}

type Row = { created_at: string; profile: ProfileLite | null }

export async function listFollowers(userId: string, cursor: string | null): Promise<Page<ProfileLite>> {
  let q = supabase
    .from('followers')
    .select(`created_at, profile:profiles!follower_id(${PROFILE_LITE})`)
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  const rows = check(await q) as unknown as Row[]
  return {
    items: rows.map((r) => r.profile).filter((p): p is ProfileLite => !!p),
    nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
  }
}

export async function listFollowing(userId: string, cursor: string | null): Promise<Page<ProfileLite>> {
  let q = supabase
    .from('followers')
    .select(`created_at, profile:profiles!following_id(${PROFILE_LITE})`)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (cursor) q = q.lt('created_at', cursor)
  const rows = check(await q) as unknown as Row[]
  return {
    items: rows.map((r) => r.profile).filter((p): p is ProfileLite => !!p),
    nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
  }
}

/** Which of the given users the signed-in user already follows (one query for a whole list). */
export async function followingAmong(me: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = check(
    await supabase.from('followers').select('following_id').eq('follower_id', me).in('following_id', ids),
  ) as { following_id: string }[]
  return new Set(rows.map((r) => r.following_id))
}
