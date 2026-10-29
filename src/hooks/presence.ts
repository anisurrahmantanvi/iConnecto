import { useEffect, useState } from 'react'
import { getPresence, touchPresence } from '@/services/presence'

const HEARTBEAT_MS = 45_000
const POLL_MS = 30_000

/** While the app is open and visible, tell the server every ~45 s that this user is active. */
export function useHeartbeat(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const beat = () => {
      if (!document.hidden) void touchPresence()
    }
    beat()
    const id = window.setInterval(beat, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', beat)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [enabled])
}

/** Presence (ms since last seen) for some people, refreshed every 30 s while visible. A missing key means unknown or hidden. */
export function usePresence(ids: string[]): Map<string, number | null> {
  const [map, setMap] = useState<Map<string, number | null>>(new Map())
  const key = ids.join(',')
  useEffect(() => {
    if (!key) {
      setMap(new Map())
      return
    }
    let cancelled = false
    const load = () => {
      if (document.hidden) return
      getPresence(key.split(',')).then((m) => !cancelled && setMap(m)).catch(() => undefined)
    }
    load()
    const id = window.setInterval(load, POLL_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', load)
    }
  }, [key])
  return map
}
