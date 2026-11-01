import { supabase } from '@/lib/supabase'

/** All reads are tolerant: they return null / empty when the database has not been updated yet. */

export interface ChatPrivacyPrefs {
  read_receipts: boolean
  typing_status: boolean
}

export async function getChatPrivacy(userId: string): Promise<ChatPrivacyPrefs | null> {
  const { data, error } = await supabase.from('profiles').select('read_receipts, typing_status').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return data as ChatPrivacyPrefs
}

export async function setChatPrivacy(userId: string, patch: Partial<ChatPrivacyPrefs>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw new Error(error.message)
}

/** When the other person last read the chat; null if hidden by either side's settings or unavailable. */
export async function getChatSeen(chatId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('chat_seen', { p_chat: chatId })
  if (error || typeof data !== 'string') return null
  return data
}

export async function listArchivedIds(): Promise<string[]> {
  const { data, error } = await supabase.from('chat_archives').select('chat_id')
  if (error || !data) return []
  return (data as { chat_id: string }[]).map((r) => r.chat_id)
}

export async function setArchived(chatId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('archive_chat', { p_chat: chatId, p_on: on })
  if (error) throw new Error(error.message)
}
