import { Link } from 'react-router-dom'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Logo } from '@/components/ui/Logo'
import { PageHeader } from '@/components/ui/PageHeader'

export default function AboutPage() {
  return (
    <>
      <PageHeader title="About iConnecto" back />
      <div className="stack">
        <GlassPanel padded>
          <div className="col" style={{ alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <Logo size={64} />
            <h2>iConnecto</h2>
            <p className="muted">Connect with friends, share moments, chat and call, in one place.</p>
          </div>
        </GlassPanel>
        <GlassPanel>
          <Link to="/privacy-policy" className="list-row list-row--link">Privacy Policy</Link>
          <Link to="/terms" className="list-row list-row--link">Terms of Service</Link>
          <Link to="/settings/help" className="list-row list-row--link">Help Center</Link>
          <Link to="/settings/support/contact" className="list-row list-row--link">Contact Support</Link>
        </GlassPanel>
      </div>
    </>
  )
}
