import { Link } from 'react-router-dom'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Logo } from '@/components/ui/Logo'

/** Where people can reach the owner about privacy. Fill this in before publishing to an app store; the line is hidden while it is empty. */
const CONTACT_EMAIL = ''

const UPDATED = '1 November 2026'

/** Public page (no sign-in needed) so an app store and users can read it. */
export default function PrivacyPolicyPage() {
  return (
    <div className="auth">
      <GlassPanel strong className="auth__card" as="main" style={{ maxWidth: 680, textAlign: 'left' }}>
        <div className="col" style={{ alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <Logo size={56} />
          <h1>Privacy Policy</h1>
          <p className="muted small">iConnecto · Last updated {UPDATED}</p>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <p>
            iConnecto is a social app for sharing posts, chatting and calling. This page explains what information the app
            uses, why, who else handles it, and how you can control or delete it.
          </p>

          <h2 className="section-title">What we collect</h2>
          <ul>
            <li><strong>Account:</strong> your email address and password (the password is stored only as a secure hash by our sign-in provider).</li>
            <li><strong>Profile:</strong> username, display name, bio, profile and cover photos, and the optional About details you add (work, education, location, relationship status).</li>
            <li><strong>Content you create:</strong> posts, photos, comments, reactions, saved posts, communities you join, and messages you send.</li>
            <li><strong>Connections and safety:</strong> who you follow, who follows you, accounts you block, and reports you file.</li>
            <li><strong>Activity status:</strong> when you were last active, so friends can see "Online". You can turn this off in Settings → Privacy and security.</li>
            <li><strong>Calls:</strong> when you call someone, the app stores the call's status and technical set-up messages so the call can connect. Voice and video go directly between the two phones where possible. We do not record calls.</li>
            <li><strong>Notifications:</strong> a push token that identifies your phone so we can send alerts for messages, calls, likes, comments and followers.</li>
          </ul>

          <h2 className="section-title">What we do not do</h2>
          <ul>
            <li>We do not show ads and we do not sell your information.</li>
            <li>We do not use third-party analytics or advertising trackers in the app.</li>
            <li>We do not read your contacts or location.</li>
          </ul>

          <h2 className="section-title">Permissions</h2>
          <p>
            The Android app may ask for the camera and microphone (for calls and for taking photos or video), photos you choose
            to upload, and permission to show notifications. You can change each one in your phone's settings.
          </p>

          <h2 className="section-title">Who handles your information</h2>
          <ul>
            <li><strong>Supabase</strong> stores the database, sign-in, uploaded files and real-time messages for iConnecto.</li>
            <li><strong>Google Firebase Cloud Messaging</strong> delivers push notifications. A notification's text, such as the beginning of a message, passes through Google to reach your phone.</li>
            <li><strong>Google (STUN)</strong> helps two phones find each other for a call, which shares network addresses needed to connect.</li>
            <li><strong>GitHub Pages</strong> hosts the app's web pages.</li>
          </ul>

          <h2 className="section-title">Who can see what</h2>
          <p>
            Posts can be Public, Followers only or Only me, and you choose this when you post. Your profile, posts and activity
            are shown according to your privacy settings. People you block cannot see your posts or message you.
          </p>

          <h2 className="section-title">Deleting your data</h2>
          <p>
            You can delete your account yourself: sign in, then go to Settings → Account Center → Delete account, or use the
            delete page on our website. Your profile is hidden at once, and after a 30-day waiting period (during which you can
            cancel by signing in) your profile, posts, comments, messages and uploaded files are permanently removed from iConnecto. You can also edit or
            delete individual posts and comments at any time.
          </p>

          <h2 className="section-title">Children</h2>
          <p>iConnecto is not meant for children under 13, and we do not knowingly collect their information.</p>

          <h2 className="section-title">Changes</h2>
          <p>If this policy changes, the date at the top will change. Significant changes will be announced in the app.</p>

          {CONTACT_EMAIL ? (
            <>
              <h2 className="section-title">Contact</h2>
              <p>Questions about privacy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
            </>
          ) : null}
        </div>

        <p className="small center muted" style={{ textAlign: 'center' }}><Link to="/">Back to iConnecto</Link></p>
      </GlassPanel>
    </div>
  )
}
