// Starts a Didit identity verification for the signed-in user and returns the hosted-flow URL.
// Secrets (set in Supabase > Edge Functions > Secrets, never in the app): DIDIT_API_KEY, DIDIT_WORKFLOW_ID, SITE_URL.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('DIDIT_API_KEY')
  const workflowId = Deno.env.get('DIDIT_WORKFLOW_ID')
  const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
  if (!apiKey || !workflowId || !siteUrl) return json({ error: 'Verification is not configured yet.' }, 503)

  const url = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Please sign in again.' }, 401)
  const userId = userData.user.id

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: prof } = await admin.from('profiles').select('is_verified').eq('id', userId).maybeSingle()
  if (prof?.is_verified) return json({ error: 'You are already verified.' }, 409)

  // at most 5 attempts per 24 h per user (each attempt costs money)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await admin.from('kyc_verifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since)
  if ((count ?? 0) >= 5) return json({ error: 'Too many attempts today. Try again tomorrow.' }, 429)

  const res = await fetch('https://verification.didit.me/v3/session/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: userId,
      callback: `${siteUrl}/settings/verify`,
      language: 'en',
    }),
  })
  if (!res.ok) {
    console.error('didit create session failed', res.status)
    return json({ error: 'The verification service is unavailable. Try again later.' }, 502)
  }
  const session = await res.json()
  if (!session?.session_id || !session?.url) return json({ error: 'Unexpected answer from the verification service.' }, 502)

  const { error: insErr } = await admin.from('kyc_verifications').insert({
    user_id: userId, provider: 'didit', provider_session_id: String(session.session_id), status: 'pending',
  })
  if (insErr) {
    console.error('insert failed', insErr.message)
    return json({ error: 'Could not start verification.' }, 500)
  }
  return json({ url: session.url })
})
