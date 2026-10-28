import { supabase, channelName } from '@/lib/supabase'
import { check } from '@/lib/api'
import type { CallSession, CallStatus, CallType } from '@/types/db'

const CALL_COLS = 'id, caller_id, callee_id, call_type, status, created_at, started_at, ended_at'

export type SignalKind = 'offer' | 'answer' | 'ice' | 'hangup'
export interface CallSignal {
  id: number
  call_id: string
  sender_id: string
  kind: SignalKind
  payload: Record<string, unknown>
  created_at: string
}

export async function createCall(calleeId: string, type: CallType): Promise<CallSession> {
  const res = await supabase.from('call_sessions').insert({ callee_id: calleeId, call_type: type }).select(CALL_COLS).single()
  return check(res) as CallSession
}

export async function getCall(id: string): Promise<CallSession | null> {
  const res = await supabase.from('call_sessions').select(CALL_COLS).eq('id', id).maybeSingle()
  return check(res) as CallSession | null
}

export async function setCallStatus(id: string, status: CallStatus): Promise<void> {
  const { error } = await supabase.from('call_sessions').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function sendSignal(callId: string, kind: SignalKind, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('call_signals').insert({ call_id: callId, kind, payload })
  if (error) throw new Error(error.message)
}

/** Signals already stored before this client subscribed (the offer may arrive before the callee opens the screen). */
export async function fetchSignals(callId: string): Promise<CallSignal[]> {
  return check(
    await supabase.from('call_signals').select('id, call_id, sender_id, kind, payload, created_at').eq('call_id', callId).order('id', { ascending: true }).limit(200),
  ) as CallSignal[]
}

export function subscribeSignals(callId: string, onSignal: (s: CallSignal) => void): () => void {
  const channel = supabase
    .channel(channelName(`call-signals:${callId}`))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `call_id=eq.${callId}` }, (p) => onSignal(p.new as CallSignal))
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

export function subscribeCallStatus(callId: string, onChange: (c: CallSession) => void): () => void {
  const channel = supabase
    .channel(channelName(`call-status:${callId}`))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${callId}` }, (p) => onChange(p.new as CallSession))
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

export function subscribeIncomingCalls(userId: string, onIncoming: (c: CallSession) => void): () => void {
  const channel = supabase
    .channel(channelName(`incoming-calls:${userId}`))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: `callee_id=eq.${userId}` }, (p) => {
      const call = p.new as CallSession
      if (call.status === 'ringing') onIncoming(call)
    })
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
