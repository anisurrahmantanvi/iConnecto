// Receives Didit's result. Deploy with --no-verify-jwt: authenticity comes from the HMAC signature instead.
// Secret: DIDIT_WEBHOOK_SECRET. Stores no personal data, only the session status.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { verifyDiditWebhook } from '../_shared/signature.ts'

const STATUS: Record<string, string> = {
  'approved': 'approved',
  'declined': 'declined',
  'in review': 'in_review',
  'abandoned': 'abandoned',
  'expired': 'expired',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const secret = Deno.env.get('DIDIT_WEBHOOK_SECRET') ?? ''
  const raw = await req.text()
  const ok = await verifyDiditWebhook(raw, req.headers.get('x-signature-v2'), req.headers.get('x-timestamp'), secret)
  if (!ok) return new Response('Invalid signature', { status: 401 })

  let payload: { session_id?: string; status?: string; webhook_type?: string }
  try { payload = JSON.parse(raw) } catch { return new Response('Bad request', { status: 400 }) }

  const mapped = STATUS[String(payload.status ?? '').toLowerCase()]
  if (!payload.session_id || !mapped) return new Response('ignored', { status: 200 }) // e.g. "In Progress"

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await admin.rpc('kyc_apply_result', { p_session_id: String(payload.session_id), p_status: mapped })
  if (error) {
    console.error('kyc_apply_result failed', error.message)
    return new Response('error', { status: 500 }) // Didit retries
  }
  return new Response('ok', { status: 200 })
})
