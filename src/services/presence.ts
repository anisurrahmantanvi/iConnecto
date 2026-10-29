import { supabase } from '@/lib/supabase'

/** Tells the server "I am here" (best effort: failures are ignored). */
export async function touchPresence(): Promise<void> {
  try {
    await supabase.rpc('touch_presence')
  } catch {
    /* offline, or the database update has not been applied yet */
  }
}

/** How long ago each person was seen, in ms. null = never seen / status off for them is simply missing from the map. */
export async function getPresence(ids: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  if (!ids.length) return out
  const { data, error } = await supabase.rpc('get_presence', { p_ids: ids })
  if (error || !data) return out
  for (const r of data as { id: string; last_seen_at: string | null; server_now: string }[]) {
    out.set(r.id, r.last_seen_at ? Math.max(0, new Date(r.server_now).getTime() - new Date(r.last_seen_at).getTime()) : null)
  }
  return out
}

export async function getMyShowActivity(userId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('profiles').select('show_activity').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return (data as { show_activity: boolean }).show_activity
}

export async function setMyShowActivity(userId: string, on: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ show_activity: on }).eq('id', userId)
  if (error) throw new Error(error.message)
  await touchPresence() // clears (or sets) the timestamp right away
}
