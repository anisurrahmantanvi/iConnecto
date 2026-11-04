import { useState } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'

const KEY = 'iconnecto.allowCopy'

/** Per-device switch. Off by default: nothing can be copied except what you type. */
export default function CopyTextPage() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  const change = (v: boolean) => {
    setOn(v)
    try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* ignore */ }
    document.documentElement.classList.toggle('allow-copy', v)
  }
  return (
    <>
      <PageHeader title="Copy Text" back />
      <div className="stack">
        <GlassPanel className="settings-list">
          <div className="list-row">
            <span className="grow"><strong style={{ display: 'block' }}>Copy post captions</strong><span className="small muted">When off, text in posts cannot be selected or copied. This applies on this device.</span></span>
            <span className="switch"><input type="checkbox" role="switch" aria-label="Copy post captions" checked={on} onChange={(e) => change(e.target.checked)} /><span className="switch__track" aria-hidden /></span>
          </div>
        </GlassPanel>
      </div>
    </>
  )
}
