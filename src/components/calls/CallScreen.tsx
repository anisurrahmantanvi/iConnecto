import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MicOff, Phone, PhoneOff, Video, VideoOff, TriangleAlert } from 'lucide-react'
import type { CallApi } from '@/hooks/useCall'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { formatDuration } from '@/lib/format'

/** Plays a MediaStream. Audio-only calls use an <audio> element so no black video layer covers the screen. */
function StreamMedia({ stream, kind, muted = false, className }: { stream: MediaStream | null; kind: 'video' | 'audio'; muted?: boolean; className?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = video.current ?? audio.current
    if (!el) return
    el.srcObject = stream
    if (stream) void el.play().catch(() => undefined) // autoplay can be refused until the user interacts
  }, [stream, kind])

  return kind === 'video' ? (
    <video ref={video} className={className} autoPlay playsInline muted={muted} />
  ) : (
    <audio ref={audio} autoPlay muted={muted} />
  )
}

function statusLabel(api: CallApi): string {
  const video = api.call?.call_type === 'video'
  switch (api.phase) {
    case 'loading': return 'Loading…'
    case 'incoming': return `Incoming ${video ? 'video' : 'voice'} call`
    case 'starting': return video ? 'Allow camera and microphone…' : 'Allow microphone access…'
    case 'ringing': return 'Ringing…'
    case 'connecting': return 'Connecting…'
    case 'connected': return formatDuration(api.seconds)
    case 'ended': return api.endReason ?? 'Call ended'
    case 'error': return 'Call problem'
  }
}

export function CallScreen({ api, onClose }: { api: CallApi; onClose: () => void }) {
  const { phase } = api
  const isVideo = api.call?.call_type === 'video'
  const showRemoteVideo = isVideo && api.remoteStream !== null
  const name = api.peer?.display_name || api.peer?.username || 'Unknown'
  const live = phase === 'starting' || phase === 'ringing' || phase === 'connecting' || phase === 'connected'

  // If the media path takes a while, say why instead of leaving the user guessing.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (phase !== 'connecting') {
      setSlow(false)
      return
    }
    const id = window.setTimeout(() => setSlow(true), 12_000)
    return () => window.clearTimeout(id)
  }, [phase])

  return (
    <div className={`call-screen ${showRemoteVideo ? 'call-screen--video' : ''}`} role="region" aria-label={`Call with ${name}`}>
      {/* Remote media plays even before the layout shows it (audio calls need no picture). */}
      <StreamMedia stream={api.remoteStream} kind={isVideo ? 'video' : 'audio'} />
      {isVideo && api.localStream && live ? <StreamMedia stream={api.localStream} kind="video" muted className="local-video" /> : null}

      <div className="call-screen__who">
        <Avatar src={api.peer?.avatar_url} name={name} size="xl" />
        <h1>{name}</h1>
        <p className="call-screen__status" role="status" aria-live="polite">
          {phase === 'loading' ? <Loader2 size={18} className="spin" aria-hidden /> : null} {statusLabel(api)}
        </p>
      </div>

      <div className="col center" style={{ alignItems: 'center' }}>
        {phase === 'error' && api.problem ? (
          <div className="glass glass--strong call-screen__note" role="alert">
            <TriangleAlert size={20} color="var(--danger)" aria-hidden style={{ display: 'inline-block', marginRight: 6, verticalAlign: '-4px' }} />
            {api.problem.message}
          </div>
        ) : null}
        {phase === 'connecting' && slow ? (
          <div className="glass glass--strong call-screen__note small" role="status">
            Still connecting… If this never connects, one of you may be on a network that blocks direct calls and needs a relay (TURN) server.
          </div>
        ) : null}
      </div>

      <div className="call-screen__actions">
        {phase === 'incoming' ? (
          <div className="call-controls">
            <span className="call-btn-label">
              <button type="button" className="call-btn call-btn--end" aria-label="Decline call" onClick={() => void api.hangUp()}>
                <PhoneOff size={26} />
              </button>
              Decline
            </span>
            <span className="call-btn-label">
              <button type="button" className="call-btn call-btn--accept" aria-label="Answer call" onClick={() => void api.accept()}>
                {isVideo ? <Video size={26} /> : <Phone size={26} />}
              </button>
              Answer
            </span>
          </div>
        ) : live ? (
          <div className="call-controls">
            <span className="call-btn-label">
              <button
                type="button"
                className="call-btn"
                data-off={api.muted}
                aria-pressed={api.muted}
                aria-label={api.muted ? 'Unmute microphone' : 'Mute microphone'}
                disabled={phase === 'starting'}
                onClick={api.toggleMute}
              >
                {api.muted ? <MicOff size={26} /> : <Mic size={26} />}
              </button>
              {api.muted ? 'Unmute' : 'Mute'}
            </span>
            {isVideo ? (
              <span className="call-btn-label">
                <button
                  type="button"
                  className="call-btn"
                  data-off={api.cameraOff}
                  aria-pressed={api.cameraOff}
                  aria-label={api.cameraOff ? 'Turn camera on' : 'Turn camera off'}
                  disabled={phase === 'starting'}
                  onClick={api.toggleCamera}
                >
                  {api.cameraOff ? <VideoOff size={26} /> : <Video size={26} />}
                </button>
                {api.cameraOff ? 'Camera on' : 'Camera off'}
              </span>
            ) : null}
            <span className="call-btn-label">
              <button type="button" className="call-btn call-btn--end" aria-label="End call" onClick={() => void api.hangUp()}>
                <PhoneOff size={26} />
              </button>
              {phase === 'ringing' && api.isCaller ? 'Cancel' : 'End'}
            </span>
          </div>
        ) : (
          <Button variant="primary" onClick={onClose}>Close</Button>
        )}
      </div>
    </div>
  )
}
