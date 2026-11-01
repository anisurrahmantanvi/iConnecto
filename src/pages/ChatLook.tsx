import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { GlassPanel } from '@/components/ui/GlassPanel'
import {
  CHAT_THEMES,
  CHAT_WALLPAPERS,
  chatLookStyle,
  getThemeId,
  getWallpaperId,
  setThemeId,
  setWallpaperId,
} from '@/lib/chatLook'

/** Chat colours (chat themes) and wallpaper. Saved on this phone. */
export default function ChatLookPage({ mode }: { mode: 'theme' | 'wallpaper' }) {
  const [theme, setTheme] = useState(getThemeId())
  const [wall, setWall] = useState(getWallpaperId())
  const style = chatLookStyle()
  const current = { ...style }
  const t = CHAT_THEMES.find((x) => x.id === theme)
  const w = CHAT_WALLPAPERS.find((x) => x.id === wall)
  if (t?.from) { current['--bubble-from'] = t.from; current['--bubble-to'] = t.to } else { delete current['--bubble-from']; delete current['--bubble-to'] }
  if (w?.css) current['--chat-wall'] = w.css; else delete current['--chat-wall']

  return (
    <>
      <PageHeader title={mode === 'theme' ? 'Chat themes' : 'Chat wallpaper'} back="/message-settings" />
      <div className="stack">
        <GlassPanel padded>
          <div className="chat-preview-box" style={current as React.CSSProperties}>
            <div className="bubble bubble--them">Hi! How are you?</div>
            <div className="bubble bubble--me">All good 🙂</div>
          </div>
        </GlassPanel>
        <GlassPanel padded className="col">
          <p className="small muted">{mode === 'theme' ? 'Choose the colour of your messages. It is saved on this phone.' : 'Choose the background behind your chats. It is saved on this phone.'}</p>
          <div className="chip-row" role="group" aria-label={mode === 'theme' ? 'Chat theme' : 'Chat wallpaper'}>
            {mode === 'theme'
              ? CHAT_THEMES.map((x) => (
                  <button key={x.id} type="button" className="chip" aria-pressed={theme === x.id} onClick={() => { setTheme(x.id); setThemeId(x.id) }}>
                    {x.label}
                  </button>
                ))
              : CHAT_WALLPAPERS.map((x) => (
                  <button key={x.id} type="button" className="chip" aria-pressed={wall === x.id} onClick={() => { setWall(x.id); setWallpaperId(x.id) }}>
                    {x.label}
                  </button>
                ))}
          </div>
        </GlassPanel>
      </div>
    </>
  )
}
