import { publicUrl } from '@/lib/base'
import { enablePush, pushAvailable, pushPermission } from '@/lib/push'

/**
 * Phone / system notifications.
 *   - In the Android app: real push notifications through Firebase (see lib/push.ts). They arrive even when the app is closed.
 *   - In a browser or installed PWA: the service worker's showNotification(), which only works while the page is still running.
 */

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export async function notificationPermission(): Promise<NotifyPermission> {
  try {
    if (pushAvailable()) return await pushPermission()
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
    const p = Notification.permission
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'default'
  } catch {
    return 'unsupported'
  }
}

export async function requestNotificationPermission(onOpen: (url: string) => void = () => undefined): Promise<NotifyPermission> {
  try {
    if (pushAvailable()) return await enablePush(onOpen)
    if (!('Notification' in window)) return 'unsupported'
    const p = await Notification.requestPermission()
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'default'
  } catch {
    return 'unsupported'
  }
}

/** Browser only (the Android app gets its alerts as push from the server). Never throws. */
export async function showSystemNotification(title: string, body: string, tag?: string): Promise<void> {
  try {
    if (pushAvailable() || !('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, { body, tag, icon: publicUrl('icons/icon-192.png'), badge: publicUrl('icons/icon-96.png') })
  } catch {
    /* a failed notification must never break the app */
  }
}
