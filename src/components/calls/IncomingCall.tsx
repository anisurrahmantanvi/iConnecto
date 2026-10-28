import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Phone, PhoneOff, Video } from 'lucide-react'
import type { CallSession, ProfileLite } from '@/types/db'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { getProfileById } from '@/services/profiles'
import { setCallStatus, subscribeCallStatus, subscribeIncomingCalls } from '@/services/calls'

const RING_WINDOW_MS = 45_000

interface Incoming {
  call: CallSession
  caller: ProfileLite | null
}

/**
 * Listens (one realtime subscription) for calls addressed to the signed-in user and shows an answer / decline sheet.
 * The call itself is set up on /call/:id; this component only offers to open it.
 */
export function IncomingCallListener() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [incoming, setIncoming] = useState<Incoming | null>(null)
  const timer = useRef<number | null>(null)
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    return subscribeIncomingCalls(userId, (call) => {
      void getProfileById(call.caller_id)
        .catch(() => null)
        .then((p) => setIncoming({ call, caller: p ? { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url } : null }))
    })
  }, [userId])

  const callId = incoming?.call.id ?? null

  // Dismiss when the caller hangs up first, or when nobody answers in time.
  useEffect(() => {
    if (!callId) return
    const off = subscribeCallStatus(callId, (c) => {
      if (c.status !== 'ringing') setIncoming(null)
    })
    timer.current = window.setTimeout(() => setIncoming(null), RING_WINDOW_MS)
    return () => {
      off()
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [callId])

  if (!incoming || location.pathname.startsWith('/call/')) return null
  const { call, caller } = incoming
  const name = caller?.display_name || caller?.username || 'Someone'

  return (
    <div className="glass glass--strong incoming-call" role="alertdialog" aria-label={`Incoming ${call.call_type} call from ${name}`}>
      <Avatar src={caller?.avatar_url} name={name} size="lg" />
      <div className="grow">
        <strong className="truncate" style={{ display: 'block' }}>{name}</strong>
        <span className="small muted">Incoming {call.call_type} call…</span>
      </div>
      <button
        type="button"
        className="call-btn call-btn--end"
        aria-label="Decline call"
        onClick={() => {
          setIncoming(null)
          void setCallStatus(call.id, 'declined').catch(() => undefined)
        }}
      >
        <PhoneOff size={24} />
      </button>
      <button
        type="button"
        className="call-btn call-btn--accept"
        aria-label="Answer call"
        onClick={() => {
          setIncoming(null)
          navigate(`/call/${call.id}`, { state: { accept: true } })
        }}
      >
        {call.call_type === 'video' ? <Video size={24} /> : <Phone size={24} />}
      </button>
    </div>
  )
}
