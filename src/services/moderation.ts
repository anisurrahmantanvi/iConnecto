import { supabase } from '@/lib/supabase'
import { check, isDuplicate, PROFILE_LITE } from '@/lib/api'
import type { ProfileLite, ReportReason, ReportTarget } from '@/types/db'

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'self_harm', label: 'Self-harm' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Something else' },
]

export async function submitReport(input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string }): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details?.trim() || null,
  })
  // Reporting the same thing twice is harmless; treat it as success.
  if (error && !isDuplicate(error)) throw new Error(error.message)
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.from('blocks').insert({ blocked_id: userId })
  if (error && !isDuplicate(error)) throw new Error(error.message)
}

export async function unblockUser(me: string, userId: string): Promise<void> {
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId)
  if (error) throw new Error(error.message)
}

export async function isBlockedByMe(me: string, userId: string): Promise<boolean> {
  const res = await supabase.from('blocks').select('blocked_id', { count: 'exact', head: true }).eq('blocker_id', me).eq('blocked_id', userId)
  if (res.error) throw new Error(res.error.message)
  return (res.count ?? 0) > 0
}

export async function listBlocked(me: string): Promise<ProfileLite[]> {
  const rows = check(
    await supabase.from('blocks').select(`created_at, profile:profiles!blocked_id(${PROFILE_LITE})`).eq('blocker_id', me).order('created_at', { ascending: false }).limit(200),
  ) as unknown as { profile: ProfileLite | null }[]
  return rows.map((r) => r.profile).filter((p): p is ProfileLite => !!p)
}
