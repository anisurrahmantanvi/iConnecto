import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Only the publishable key is used here. Authorization is enforced by RLS in the database.
export const supabase = createClient(
  env.supabaseUrl || 'http://localhost:54321',
  env.supabaseKey || 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  },
)

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return friendly(err.message)
  const m = (err as { message?: unknown }).message
  return typeof m === 'string' && m ? friendly(m) : fallback
}

function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('networkerror')) return 'Network problem. Check your connection and try again.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many requests. Please wait a moment and try again.'
  if (m.includes('row-level security') || m.includes('permission denied')) return 'You do not have permission to do that.'
  if (m.includes('duplicate key')) return 'That already exists.'
  return message
}

let channelSeq = 0
/**
 * Realtime channel names must be unique per subscription. supabase-js hands back the *same* channel object for a
 * repeated name, and adding listeners to an already-subscribed channel throws. That happens when React StrictMode
 * (development) subscribes, unsubscribes and re-subscribes, or when two screens listen to the same stream.
 */
export function channelName(base: string): string {
  channelSeq += 1
  return `${base}#${Date.now().toString(36)}${channelSeq.toString(36)}`
}
