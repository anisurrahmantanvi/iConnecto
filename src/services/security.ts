import { supabase } from '@/lib/supabase'

const KEY = 'iconnecto.deviceKey'

export interface Device { id: string; device_key: string; label: string; first_seen: string; last_seen: string }

export function deviceKey(): string {
  try {
    let k = localStorage.getItem(KEY)
    if (!k) {
      k = crypto.randomUUID()
      localStorage.setItem(KEY, k)
    }
    return k
  } catch {
    return 'session-' + Math.random().toString(36).slice(2, 12)
  }
}

export function deviceLabel(): string {
  const ua = navigator.userAgent
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone/iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Device'
  const app = /\bwv\b/.test(ua) ? 'iConnecto app' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${os} · ${app}`
}

/** Tells the database this device is signed in. Never throws (works before the SQL update is run). */
export async function registerDevice(): Promise<void> {
  try {
    await supabase.rpc('register_device', { p_key: deviceKey(), p_label: deviceLabel() })
  } catch { /* ignore */ }
}

export async function listDevices(): Promise<Device[] | null> {
  const { data, error } = await supabase.from('user_devices').select('*').order('last_seen', { ascending: false })
  if (error) return null
  return (data ?? []) as Device[]
}

export async function signOutOthersAndForget(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) throw new Error(error.message)
  try { await supabase.rpc('forget_other_devices', { p_key: deviceKey() }) } catch { /* ignore */ }
}

export async function getSecurityAlerts(userId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('profiles').select('security_alerts').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return (data as { security_alerts: boolean }).security_alerts
}

export async function setSecurityAlerts(userId: string, on: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ security_alerts: on }).eq('id', userId)
  if (error) throw new Error(error.message)
}

/* ---- Two-factor (authenticator app) ---- */
export interface TotpFactor { id: string; status: string }

export async function listTotp(): Promise<TotpFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  return (data.totp ?? []).map((f) => ({ id: f.id, status: f.status }))
}

export async function enrollTotp(): Promise<{ id: string; qr: string; secret: string }> {
  // Remove half-finished attempts first, otherwise Supabase refuses a second enrollment.
  const old = await supabase.auth.mfa.listFactors()
  for (const f of (old.data?.all ?? []).filter((x) => x.factor_type === 'totp' && x.status === 'unverified')) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'iConnecto ' + new Date().toISOString().slice(0, 10) })
  if (error) throw new Error(error.message)
  return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, '') })
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? 'That code is not correct. Try the newest code from your app.' : error.message)
}

export async function removeTotp(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}

/** The factor to ask for after login, or null when no second step is needed. */
export async function pendingMfaFactor(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return null
  if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
    const f = await supabase.auth.mfa.listFactors()
    return f.data?.totp?.[0]?.id ?? null
  }
  return null
}
