const ONLINE_MS = 2 * 60 * 1000

export interface PresenceText {
  online: boolean
  label: string
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

/**
 * ageMs: undefined = unknown or hidden (show nothing), null = never seen, number = how long ago the person was last active.
 */
export function describePresence(ageMs: number | null | undefined): PresenceText | null {
  if (ageMs === undefined) return null
  if (ageMs === null) return { online: false, label: 'Offline' }
  if (ageMs < ONLINE_MS) return { online: true, label: 'Online' }
  const min = Math.round(ageMs / 60000)
  if (min < 60) return { online: false, label: `Active ${plural(Math.max(min, 2), 'minute')} ago` }
  const hours = Math.round(min / 60)
  if (hours < 24) return { online: false, label: `Active ${plural(hours, 'hour')} ago` }
  const days = Math.round(hours / 24)
  if (days < 7) return { online: false, label: `Active ${plural(days, 'day')} ago` }
  return { online: false, label: 'Offline' }
}
