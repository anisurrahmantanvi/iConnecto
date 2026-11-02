import { Music } from 'lucide-react'
import type { PostAudio } from '@/services/music'

/** Plays one track at a time: starting this one pauses any other audio on the page. */
export function PostMusic({ audio }: { audio: PostAudio }) {
  return (
    <div className="glass col" style={{ padding: 10, gap: 6, borderRadius: 14 }}>
      <div className="row" style={{ gap: 8 }}>
        <Music size={18} aria-hidden />
        <span className="grow" style={{ minWidth: 0 }}>
          <strong className="truncate" style={{ display: 'block' }}>{audio.title}</strong>
          <span className="small muted truncate" style={{ display: 'block' }}>{audio.artist || (audio.source === 'upload' ? 'Original audio' : 'iConnecto music')}</span>
        </span>
      </div>
      <audio
        controls
        preload="none"
        src={audio.audio_url}
        style={{ width: '100%' }}
        onPlay={(e) => document.querySelectorAll('audio').forEach((a) => { if (a !== e.currentTarget) a.pause() })}
      />
    </div>
  )
}
