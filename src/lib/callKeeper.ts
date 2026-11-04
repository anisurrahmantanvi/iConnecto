import { Capacitor, registerPlugin } from '@capacitor/core'

interface CallKeeperApi {
  start(o: { name: string; video: boolean }): Promise<void>
  stop(): Promise<void>
}
const plugin = registerPlugin<CallKeeperApi>('CallKeeper')
const ok = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CallKeeper')

/** Android app only: keep the call alive while the user is in another app. Silently does nothing on the web. */
export function startCallKeeper(name: string, video: boolean) {
  if (ok()) void plugin.start({ name, video }).catch(() => undefined)
}
export function stopCallKeeper() {
  if (ok()) void plugin.stop().catch(() => undefined)
}
