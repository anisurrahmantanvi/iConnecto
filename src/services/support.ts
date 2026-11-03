import { supabase } from '@/lib/supabase'
import { check } from '@/lib/api'

export type SupportKind = 'problem' | 'bug' | 'feature' | 'contact'
export interface SupportRequest { id: string; kind: SupportKind; subject: string; message: string; status: 'open' | 'in_review' | 'resolved' | 'closed'; reply: string | null; created_at: string }

export const KIND_LABEL: Record<SupportKind, string> = { problem: 'Problem', bug: 'Bug', feature: 'Feature request', contact: 'Support' }
export const STATUS_LABEL: Record<SupportRequest['status'], string> = { open: 'Received', in_review: 'In review', resolved: 'Resolved', closed: 'Closed' }

function missing(err: { message?: string; code?: string } | null): boolean {
  return !!err && (err.code === 'PGRST205' || err.code === '42P01' || /could not find the table|does not exist|schema cache/i.test(err.message ?? ''))
}

export async function sendSupportRequest(kind: SupportKind, subject: string, message: string): Promise<void> {
  const { error } = await supabase.from('support_requests').insert({ kind, subject: subject.trim(), message: message.trim() })
  if (missing(error)) throw new Error('Support requests will be available after the next database update.')
  if (error) throw new Error(error.message)
}

/** My requests, newest first. null = not installed yet. */
export async function listMyRequests(): Promise<SupportRequest[] | null> {
  const res = await supabase.from('support_requests').select('id, kind, subject, message, status, reply, created_at').order('created_at', { ascending: false }).limit(50)
  if (missing(res.error)) return null
  return check(res) as unknown as SupportRequest[]
}
