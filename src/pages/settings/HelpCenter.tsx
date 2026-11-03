import { Link } from 'react-router-dom'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'

const FAQ: { q: string; a: string }[] = [
  { q: 'How do I add a friend?', a: 'Open someone\'s profile and tap Add friend. When they accept, you become friends and see each other\'s friends-only posts.' },
  { q: 'Who can message me?', a: 'Friends chat with you directly. Other people\'s first message goes to Message Requests, where you can Accept or Decline.' },
  { q: 'How do I change my email or password?', a: 'Settings → Account Center. Changing your email asks for a code on both the old and the new address.' },
  { q: 'How do I turn on two-step verification?', a: 'Settings → Two-Factor Authentication. You can use an authenticator app or an email code.' },
  { q: 'How do I block or report someone?', a: 'Open their profile, tap the ⋯ menu and choose Block or Report. Blocked people cannot message you or see your posts.' },
  { q: 'How do I delete a post or comment?', a: 'Tap the ⋯ menu on your post or comment and choose Delete.' },
  { q: 'I did not get my verification code.', a: 'Check your spam folder, make sure the address is spelled correctly, then tap "Send a new code" after the timer ends.' },
  { q: 'How do I create a Page?', a: 'Menu → Pages → +. Pages are for creators, businesses, communities and media. Followers see your page posts in their feed.' },
  { q: 'How do I delete my account?', a: 'Settings → Account Center → Delete account. This removes your account and content and cannot be undone.' },
]

export default function HelpCenterPage() {
  return (
    <>
      <PageHeader title="Help Center" back />
      <div className="stack">
        <GlassPanel padded>
          <div className="stack">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary style={{ fontWeight: 600, cursor: 'pointer' }}>{f.q}</summary>
                <p className="muted" style={{ marginTop: 6 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </GlassPanel>
        <GlassPanel padded>
          <p>Still stuck? <Link to="/settings/support/support">Contact Support</Link> or <Link to="/settings/support/problem">report a problem</Link>.</p>
        </GlassPanel>
      </div>
    </>
  )
}
