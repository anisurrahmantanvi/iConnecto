import { Link } from 'react-router-dom'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Logo } from '@/components/ui/Logo'

const UPDATED = '4 November 2026'

/** Public page (no sign-in). Plain-language draft: have it reviewed by a lawyer before the store release. */
export default function TermsPage() {
  return (
    <div className="auth">
      <GlassPanel strong className="auth__card" as="main" style={{ maxWidth: 680, textAlign: 'left' }}>
        <div className="col" style={{ alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <Logo size={56} />
          <h1>Terms of Service</h1>
          <p className="muted small">iConnecto · Last updated {UPDATED}</p>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <p>By creating an account or using iConnecto you agree to these terms. If you do not agree, please do not use the app.</p>
          <h2 className="section-title">Your account</h2>
          <ul>
            <li>You must give a real email address and keep your password and verification codes private.</li>
            <li>You are responsible for what happens under your account.</li>
            <li>One person, one account. Do not pretend to be someone else.</li>
          </ul>
          <h2 className="section-title">Your content</h2>
          <ul>
            <li>You own what you post. You allow iConnecto to store and show it to the people you choose so the app can work.</li>
            <li>Only post things you have the right to share, including photos and music.</li>
            <li>You can delete your posts or your whole account at any time.</li>
          </ul>
          <h2 className="section-title">Not allowed</h2>
          <ul>
            <li>Harassment, threats, hate, or sexual content involving minors.</li>
            <li>Spam, scams, fake accounts, or trying to break into other accounts.</li>
            <li>Malware, or anything that harms the app or other people.</li>
            <li>Posting other people's private information without permission.</li>
          </ul>
          <h2 className="section-title">Safety and enforcement</h2>
          <p>You can block and report people and content. We may remove content or limit or close accounts that break these terms.</p>
          <h2 className="section-title">Buy & Sell</h2>
          <p>Listings are made by users. iConnecto does not take payments yet. Meet and pay carefully and report anything suspicious.</p>
          <h2 className="section-title">Service</h2>
          <p>We work to keep iConnecto available but cannot promise it will always be error-free or uninterrupted. Features may change.</p>
          <h2 className="section-title">Changes</h2>
          <p>We may update these terms. Important changes will be shown in the app. Using the app after a change means you accept it.</p>
          <p className="small muted">See also our <Link to="/privacy-policy">Privacy Policy</Link>.</p>
        </div>
      </GlassPanel>
    </div>
  )
}
