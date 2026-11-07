import { useEffect, useState } from 'react'

/** Which Page this device is acting as ("" = your own profile). Stored per device, like Facebook's profile switch. */
const KEY = 'iconnecto.actingAs'
const EVT = 'iconnecto:actingAs'

export function getActingAs(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}
export function setActingAs(slug: string): void {
  try { if (slug) localStorage.setItem(KEY, slug); else localStorage.removeItem(KEY) } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT))
}
export function useActingAs(): string {
  const [slug, setSlug] = useState(getActingAs)
  useEffect(() => {
    const on = () => setSlug(getActingAs())
    window.addEventListener(EVT, on)
    return () => window.removeEventListener(EVT, on)
  }, [])
  return slug
}
