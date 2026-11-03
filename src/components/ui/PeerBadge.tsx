import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { VerifiedBadge } from './VerifiedBadge'

type Badge = 'verified' | 'professional' | null
const cache = new Map<string, Badge>()
const waiting = new Map<string, Array<(b: Badge) => void>>()
let timer: ReturnType<typeof setTimeout> | null = null

function flush() {
  timer = null
  const ids = [...waiting.keys()]
  const batch = new Map(waiting)
  waiting.clear()
  void (async () => {
    let found = new Map<string, Badge>()
    try {
      const { data } = await supabase.from('profiles').select('id, badge').in('id', ids)
      for (const r of (data ?? []) as { id: string; badge: Badge }[]) found.set(r.id, r.badge ?? null)
    } catch { found = new Map() }
    for (const [id, cbs] of batch) {
      const b = found.get(id) ?? null
      cache.set(id, b)
      cbs.forEach((cb) => cb(b))
    }
  })()
}

function request(id: string, cb: (b: Badge) => void) {
  const list = waiting.get(id) ?? []
  list.push(cb)
  waiting.set(id, list)
  if (!timer) timer = setTimeout(flush, 30)
}

/** Blue check for lists that only carry a user id (chat list, chat header, requests). Batches lookups. */
export function PeerBadge({ userId, size = 15 }: { userId?: string | null; size?: number }) {
  const [badge, setBadge] = useState<Badge>(userId ? cache.get(userId) ?? null : null)
  useEffect(() => {
    if (!userId) return
    if (cache.has(userId)) { setBadge(cache.get(userId) ?? null); return }
    let off = false
    request(userId, (b) => { if (!off) setBadge(b) })
    return () => { off = true }
  }, [userId])
  return <VerifiedBadge badge={badge} size={size} />
}
