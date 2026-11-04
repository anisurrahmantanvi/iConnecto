import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Phone, PhoneOff } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { CallScreen } from '@/components/calls/CallScreen'
import { useCall } from '@/hooks/useCall'
import { setBackGuard } from '@/hooks/useBackButton'
import { formatDuration } from '@/lib/format'
import { startCallKeeper, stopCallKeeper } from '@/lib/callKeeper'

interface Active { id: string; accept: boolean }
interface CallCtx {
  /** A call is running (ringing, connecting or connected) and has not ended yet. */
  inCall: boolean
  open: (id: string, accept: boolean) => void
}
const Ctx = createContext<CallCtx>({ inCall: false, open: () => undefined })
export const useCallControl = () => useContext(Ctx)

/**
 * Keeps one call alive for as long as it lasts, no matter which screen is open.
 * The call screen is only a view of it: leaving the /call/<id> page minimises the call into a bar at the top
 * instead of hanging up. Tapping the bar brings the call screen back.
 */
function Runner({ active, myId, onFinished, onLive }: { active: Active; myId: string; onFinished: () => void; onLive: (live: boolean) => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const api = useCall({ callId: active.id, myId, autoAccept: active.accept })
  const over = api.phase === 'ended' || api.phase === 'error'
  const onCallPage = location.pathname === `/call/${active.id}`
  const name = api.peer?.display_name || api.peer?.username || 'Call'

  useEffect(() => { onLive(!over) }, [over, onLive])

  // Android app: keep the call running while the user is in another app.
  const keep = !over && (api.phase === 'ringing' || api.phase === 'connecting' || api.phase === 'connected')
  const isVideo = api.call?.call_type === 'video'
  useEffect(() => {
    if (!keep) return
    startCallKeeper(name, isVideo)
    return () => stopCallKeeper()
  }, [keep, name, isVideo])

  // Phone back button on the call screen minimises the call (it keeps running) instead of ending it.
  useEffect(() => {
    if (!onCallPage || over) return
    setBackGuard(() => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
      if (idx > 0) navigate(-1)
      else navigate('/messages', { replace: true })
      return true
    })
    return () => setBackGuard(null)
  }, [onCallPage, over, navigate])

  // If the other person hangs up while the call is minimised, show it briefly, then clear.
  useEffect(() => {
    if (!over || onCallPage) return
    const id = window.setTimeout(onFinished, 3000)
    return () => window.clearTimeout(id)
  }, [over, onCallPage, onFinished])

  useEffect(() => {
    const root = document.documentElement
    const show = !onCallPage
    root.classList.toggle('has-callbar', show)
    return () => root.classList.remove('has-callbar')
  }, [onCallPage])

  const close = () => {
    onFinished()
    if (onCallPage) navigate('/messages', { replace: true })
  }

  return (
    <>
      <div style={{ display: onCallPage ? 'contents' : 'none' }}>
        <CallScreen api={api} onClose={close} />
      </div>
      {!onCallPage ? (
        <div className="callbar" role="status">
          <button type="button" className="callbar__main" onClick={() => navigate(`/call/${active.id}`)}>
            <Phone size={16} aria-hidden />
            <strong className="truncate">{name}</strong>
            <span className="callbar__time">{api.phase === 'connected' ? formatDuration(api.seconds) : over ? (api.endReason ?? 'Call ended') : 'Calling…'}</span>
            <span className="callbar__hint">Tap to return</span>
          </button>
          {!over ? (
            <button type="button" className="callbar__end" aria-label="End call" onClick={() => void api.hangUp()}><PhoneOff size={18} /></button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [active, setActive] = useState<Active | null>(null)
  const [inCall, setInCall] = useState(false)

  const open = useCallback((id: string, accept: boolean) => {
    setActive((cur) => (cur?.id === id ? cur : { id, accept }))
  }, [])
  const onFinished = useCallback(() => { setActive(null); setInCall(false) }, [])
  const onLive = useCallback((live: boolean) => setInCall(live), [])
  const value = useMemo(() => ({ inCall, open }), [inCall, open])

  return (
    <Ctx.Provider value={value}>
      {children}
      {active && user ? <Runner key={active.id} active={active} myId={user.id} onFinished={onFinished} onLive={onLive} /> : null}
    </Ctx.Provider>
  )
}
