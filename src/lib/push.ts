import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from '@/lib/supabase'

/** True only inside the Android app. In a browser these functions do nothing. */
export const pushAvailable = (): boolean => Capacitor.isNativePlatform()

const TOKEN_KEY = 'ic.pushToken'

/** Plain-words trail of what happened, shown in Settings so a problem can be seen on the phone itself. */
const trail: string[] = []
function note(msg: string) {
  trail.push(msg)
  if (trail.length > 8) trail.shift()
}
export function pushStatus(): string[] {
  return [...trail]
}

function remember(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage can be unavailable */
  }
}

function remembered(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export type PushPermission = 'granted' | 'denied' | 'default'

export async function pushPermission(): Promise<PushPermission> {
  const p = await PushNotifications.checkPermissions()
  return p.receive === 'granted' ? 'granted' : p.receive === 'denied' ? 'denied' : 'default'
}

/** Asks for permission if needed (Android shows its own dialog once), then registers this phone for push. */
export async function enablePush(onOpen: (url: string) => void): Promise<PushPermission> {
  try {
    return await enablePushInner(onOpen)
  } catch (e) {
    note('Error: ' + (e instanceof Error ? e.message : String(e)))
    throw e
  }
}

async function enablePushInner(onOpen: (url: string) => void): Promise<PushPermission> {
  note('Starting')
  let perm = await PushNotifications.checkPermissions()
  note('Permission: ' + perm.receive)
  if (perm.receive !== 'granted' && perm.receive !== 'denied') perm = await PushNotifications.requestPermissions()
  note('Permission now: ' + perm.receive)
  if (perm.receive !== 'granted') return perm.receive === 'denied' ? 'denied' : 'default'

  await PushNotifications.createChannel({ id: 'iconnecto', name: 'Messages and activity', importance: 5, visibility: 1, vibration: true })
  await PushNotifications.createChannel({ id: 'calls', name: 'Calls', importance: 5, visibility: 1, vibration: true })

  await PushNotifications.removeAllListeners()
  await PushNotifications.addListener('registration', (t) => {
    remember(t.value)
    note('Phone got a token')
    void supabase.rpc('register_push_token', { p_token: t.value }).then(({ error }) => note(error ? 'Saving token failed: ' + error.message : 'Token saved'))
  })
  await PushNotifications.addListener('registrationError', (e) => note('Registration error: ' + String(e.error)))
  // Tapping a notification opens the matching screen.
  await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const url = (a.notification.data as { url?: unknown } | undefined)?.url
    if (typeof url === 'string' && url.startsWith('/')) onOpen(url)
  })
  note('Asking Google for a token')
  await PushNotifications.register()
  return 'granted'
}

/** Call before signing out, so the next person on this phone does not receive your notifications. */
export async function disablePushForThisPhone(): Promise<void> {
  const token = remembered()
  if (!token) return
  try {
    await supabase.rpc('unregister_push_token', { p_token: token })
    remember(null)
  } catch {
    /* best effort */
  }
}
