import { publicUrl } from '@/lib/base'

/**
 * Phone / system notifications.
 *   - In the Android app: the native "LocalNotifications" plugin (added when the APK is built).
 *   - In a browser or installed PWA: the service worker's showNotification().
 * Both only work while the app is still running (open, or recently minimised). Alerts while the app is fully closed need a push
 * service, which is not set up yet.
 */

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported'

interface NativeNotifications {
  checkPermissions(): Promise<{ display: string }>
  requestPermissions(): Promise<{ display: string }>
  schedule(options: { notifications: { id: number; title: string; body: string; extra?: unknown }[] }): Promise<unknown>
}

function native(): NativeNotifications | null {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } }).Capacitor
  if (!cap?.isNativePlatform?.()) return null
  return (cap.Plugins?.LocalNotifications as NativeNotifications | undefined) ?? null
}

function isNativeApp(): boolean {
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
}

function mapPermission(v: string): NotifyPermission {
  return v === 'granted' ? 'granted' : v === 'denied' ? 'denied' : 'default'
}

export async function notificationPermission(): Promise<NotifyPermission> {
  try {
    if (isNativeApp()) {
      const n = native()
      return n ? mapPermission((await n.checkPermissions()).display) : 'unsupported'
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
    return mapPermission(Notification.permission)
  } catch {
    return 'unsupported'
  }
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  try {
    if (isNativeApp()) {
      const n = native()
      return n ? mapPermission((await n.requestPermissions()).display) : 'unsupported'
    }
    if (!('Notification' in window)) return 'unsupported'
    return mapPermission(await Notification.requestPermission())
  } catch {
    return 'unsupported'
  }
}

/** Shows a system notification. Never throws. Call it only when the permission is already granted. */
export async function showSystemNotification(title: string, body: string, tag?: string): Promise<void> {
  try {
    const n = native()
    if (n) {
      await n.schedule({ notifications: [{ id: Math.floor(Date.now() % 2_000_000_000), title, body }] })
      return
    }
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, { body, tag, icon: publicUrl('icons/icon-192.png'), badge: publicUrl('icons/icon-96.png') })
  } catch {
    /* a failed notification must never break the app */
  }
}
