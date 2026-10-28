import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2, TriangleAlert } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { CallScreen } from '@/components/calls/CallScreen'
import { Button } from '@/components/ui/Button'
import { useCall } from '@/hooks/useCall'
import { errorMessage } from '@/lib/supabase'
import { createCall } from '@/services/calls'
import type { CallType } from '@/types/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * /call/new?to=<user id>&type=audio|video
 * Creates the call row (the server checks blocks and fills in the caller), then moves to /call/<id>.
 */
function NewCall() {
  const me = useMe()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const to = params.get('to') ?? ''
  const type: CallType = params.get('type') === 'video' ? 'video' : 'audio'
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return // StrictMode runs effects twice in development; create the call only once
    started.current = true
    if (!UUID_RE.test(to) || to === me.id) {
      setError('That call can’t be started.')
      return
    }
    createCall(to, type)
      .then((c) => navigate(`/call/${c.id}`, { replace: true }))
      .catch((e) => {
        const msg = errorMessage(e)
        setError(msg.toLowerCase().includes('not available') ? 'Calling isn’t available with this person.' : msg)
      })
  }, [to, type, me.id, navigate])

  return (
    <div className="call-screen" role="region" aria-label="Starting call">
      <div className="call-screen__who">
        {error ? (
          <TriangleAlert size={40} color="var(--danger)" aria-hidden />
        ) : (
          <Loader2 size={40} className="spin" aria-hidden />
        )}
        <h1>{error ? 'Couldn’t start the call' : 'Starting call…'}</h1>
        {error ? <p className="call-screen__status" role="alert">{error}</p> : null}
      </div>
      <span />
      {error ? <Button variant="primary" onClick={() => navigate(-1)}>Go back</Button> : <span />}
    </div>
  )
}

function ActiveCall({ callId }: { callId: string }) {
  const me = useMe()
  const navigate = useNavigate()
  const location = useLocation()
  const autoAccept = (location.state as { accept?: boolean } | null)?.accept === true
  const api = useCall({ callId, myId: me.id, autoAccept })
  return <CallScreen api={api} onClose={() => navigate('/messages', { replace: true })} />
}

export default function CallPage() {
  const { callId = '' } = useParams()
  return callId === 'new' ? <NewCall /> : <ActiveCall callId={callId} />
}
