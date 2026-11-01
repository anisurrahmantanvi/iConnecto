import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, channelName } from '@/lib/supabase'

/**
 * "typing…" between the two people in a chat, over a realtime broadcast (nothing is stored).
 * When `enabled` is false you neither send nor see typing.
 */
export function useTyping(chatId: string, meId: string, enabled: boolean): { peerTyping: boolean; ping: () => void } {
  const [peerTyping, setPeerTyping] = useState(false)
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastSent = useRef(0)
  const off = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || !chatId) return
    const c = supabase.channel(channelName(`typing:${chatId}`), { config: { broadcast: { self: false } } })
    c.on('broadcast', { event: 'typing' }, (msg) => {
      if ((msg.payload as { user?: string } | null)?.user === meId) return
      setPeerTyping(true)
      if (off.current) window.clearTimeout(off.current)
      off.current = window.setTimeout(() => setPeerTyping(false), 4000)
    })
    c.subscribe()
    chan.current = c
    return () => {
      if (off.current) window.clearTimeout(off.current)
      chan.current = null
      setPeerTyping(false)
      void supabase.removeChannel(c)
    }
  }, [chatId, meId, enabled])

  const ping = useCallback(() => {
    if (!enabled || !chan.current) return
    const now = Date.now()
    if (now - lastSent.current < 2500) return
    lastSent.current = now
    void chan.current.send({ type: 'broadcast', event: 'typing', payload: { user: meId } })
  }, [enabled, meId])

  return { peerTyping, ping }
}
