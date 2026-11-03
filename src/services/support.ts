import { supabase } from '@/lib/supabase'
import { check } from '@/lib/api'
import { NOT_INSTALLED, sendSupportRequest as send, type SupportKind } from './settingsData'

export type { SupportKind }
export interface SupportRequest { id: string; kind: SupportKind; message: string; status: 'new' | 'seen' | 'done'; created_at: string }

export const KIND_LABEL: Record<SupportKind, string> = { problem: 'Problem', bug: 'Bug', feature: 'Feature request', support: 'Support' }
export const STATUS_LABEL: Record<SupportRequest['status'], string> = { new: 'Received', seen: 'Seen by the team', done: 'Done' }

export const sendSupportRequest = (kind: SupportKind, subject: string, message: string) => send(kind, `${subject.trim()}\n\n${message.trim()}`)

/** My requests, newest first. null = not installed yet. */
export async function listMyRequests(): Promise<SupportRequest[] | null> {
  const res = await supabase.from('support_requests').select('id, kind, message, status, created_at').order('created_at', { ascending: false }).limit(50)
  if (res.error && (res.error.code === 'PGRST205' || res.error.code === '42P01' || /schema cache|does not exist/i.test(res.error.message))) return null
  return check(res) as unknown as SupportRequest[]
}
export { NOT_INSTALLED }
