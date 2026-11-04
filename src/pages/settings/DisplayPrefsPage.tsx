import { useState } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDisplayPrefs, setDisplayPrefs, type DisplayPrefs } from '@/lib/displayPrefs'

const SIZES: { v: DisplayPrefs['fontSize']; label: string }[] = [
  { v: 'small', label: 'Small' }, { v: 'normal', label: 'Normal' }, { v: 'large', label: 'Large' }, { v: 'xlarge', label: 'Extra large' },
]

function Row({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="list-row">
      <span className="grow"><strong style={{ display: 'block' }}>{title}</strong><span className="small muted">{hint}</span></span>
      <span className="switch"><input type="checkbox" role="switch" aria-label={title} checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="switch__track" aria-hidden /></span>
    </div>
  )
}

/** Accessibility, data saver and reels playback. These apply on this device only. */
export default function DisplayPrefsPage() {
  const [p, setP] = useState(getDisplayPrefs)
  const set = (patch: Partial<DisplayPrefs>) => setP(setDisplayPrefs(patch))
  return (
    <>
      <PageHeader title="Accessibility & Media" back />
      <div className="stack">
        <GlassPanel className="settings-list">
          <div className="list-row" style={{ display: 'block' }}>
            <strong style={{ display: 'block' }}>Text size</strong>
            <span className="small muted">Makes text larger or smaller across the app.</span>
            <div className="chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {SIZES.map((s) => (
                <button key={s.v} type="button" className={p.fontSize === s.v ? 'btn btn--primary' : 'btn'} aria-pressed={p.fontSize === s.v} onClick={() => set({ fontSize: s.v })}>{s.label}</button>
              ))}
            </div>
          </div>
          <Row title="Reduce motion" hint="Turns off animations and transitions." checked={p.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
          <Row title="High contrast" hint="Stronger text and borders for easier reading." checked={p.highContrast} onChange={(v) => set({ highContrast: v })} />
        </GlassPanel>
        <GlassPanel className="settings-list">
          <Row title="Data saver" hint="Videos load only when you play them, to use less mobile data." checked={p.dataSaver} onChange={(v) => set({ dataSaver: v })} />
          <Row title="Autoplay reels" hint="When off, reels start only when you tap them." checked={p.reelsAutoplay} onChange={(v) => set({ reelsAutoplay: v })} />
        </GlassPanel>
        <p className="small muted">These settings are saved on this device only.</p>
      </div>
    </>
  )
}
