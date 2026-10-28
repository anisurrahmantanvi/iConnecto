import { Suspense } from 'react'
import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { Bell, Bookmark, Compass, Home, MessageCircle, Plus, Settings, User, Users, WifiOff, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useBadges } from '@/app/BadgesProvider'
import { useOnline } from '@/hooks/common'
import { useT } from '@/lib/i18n'
import { IncomingCallListener } from '@/components/calls/IncomingCall'
import { Spinner } from '@/components/ui/Feedback'
import { Logo } from '@/components/ui/Logo'

interface NavItemProps {
  to: string
  icon: LucideIcon
  label: string
  badge?: number
  end?: boolean
  create?: boolean
}

function NavItem({ to, icon: Icon, label, badge = 0, end, create }: NavItemProps) {
  return (
    <NavLink to={to} end={end} className={`nav-item ${create ? 'nav-item--create' : ''}`}>
      {create ? (
        <span className="nav-create"><Icon size={22} aria-hidden /></span>
      ) : (
        <Icon size={22} aria-hidden />
      )}
      <span>{label}</span>
      {badge > 0 ? <span className="badge" aria-label={`${badge} unread`}>{badge > 99 ? '99+' : badge}</span> : null}
    </NavLink>
  )
}

/** Signed-in layout: glass sidebar on wide screens, floating bottom navigation on phones. */
export function AppShell() {
  const { t } = useT()
  const { profile } = useAuth()
  const badges = useBadges()
  const online = useOnline()
  // Conversations and calls need the full screen on a phone, so the tab bar is hidden there.
  // Both hooks must run on every render (`||` would skip the second one and break React's hook order).
  const inChat = useMatch('/messages/:chatId')
  const inCall = useMatch('/call/:callId')
  const immersive = !!inChat || !!inCall
  const username = profile?.username ?? ''

  return (
    <div className={`shell ${immersive ? 'shell--immersive' : ''}`}>
      <a href="#main" className="skip-link">Skip to content</a>

      <aside className="glass sidebar" aria-label="Main navigation">
        <div className="brand"><Logo size={34} decorative /> iConnecto</div>
        <NavItem to="/" icon={Home} label={t('nav.home')} end />
        <NavItem to="/discover" icon={Compass} label={t('nav.discover')} />
        <NavItem to="/messages" icon={MessageCircle} label={t('nav.messages')} badge={badges.unreadMessages} />
        <NavItem to="/notifications" icon={Bell} label={t('nav.notifications')} badge={badges.unreadNotifications} />
        <NavItem to="/communities" icon={Users} label={t('nav.communities')} />
        <NavItem to="/saved" icon={Bookmark} label={t('nav.saved')} />
        <NavItem to={`/u/${username}`} icon={User} label={t('nav.profile')} />
        <NavItem to="/settings" icon={Settings} label={t('nav.settings')} />
        <span className="spacer" />
        <NavLink to="/create" className="btn btn--primary btn--block"><Plus size={18} aria-hidden /> {t('nav.create')}</NavLink>
      </aside>

      <main className="shell__main" id="main" tabIndex={-1}>
        {/* Lazy pages suspend here, so the navigation stays on screen while a screen's code loads. */}
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>

      {!immersive ? (
        <nav className="glass bottom-nav" aria-label="Main navigation">
          <NavItem to="/" icon={Home} label={t('nav.home')} end />
          <NavItem to="/discover" icon={Compass} label={t('nav.discover')} />
          <NavItem to="/create" icon={Plus} label={t('nav.create')} create />
          <NavItem to="/notifications" icon={Bell} label={t('nav.notifications')} badge={badges.unreadNotifications} />
          <NavItem to={`/u/${username}`} icon={User} label={t('nav.profile')} />
        </nav>
      ) : null}

      {!online ? (
        <div className="glass banner banner--offline" role="status">
          <WifiOff size={18} aria-hidden /> You're offline. Changes can't be saved until you reconnect.
        </div>
      ) : null}

      <IncomingCallListener />
    </div>
  )
}
