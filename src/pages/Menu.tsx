import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Bookmark, ChevronDown, Compass, Film, Heart, HelpCircle, LogOut, MessageCircle, Pencil, Settings, SquarePlus, UserPlus, Users } from 'lucide-react'
import { useAuth, useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { appUrl } from '@/lib/base'
import { sectionSlug } from '@/pages/settings/settingsMenu'

function Tile({ to, icon, label, color }: { to: string; icon: ReactNode; label: string; color: string }) {
  return (
    <Link to={to} className="glass menu-tile" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 'var(--r-md)', color: 'inherit' }}>
      <span style={{ color }}>{icon}</span>
      <strong style={{ fontWeight: 600 }}>{label}</strong>
    </Link>
  )
}

function Expand({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <GlassPanel className="settings-list" as="section" aria-label={title}>
      <button type="button" className="list-row" aria-expanded={open} onClick={() => setOpen(!open)} style={{ width: '100%', textAlign: 'left' }}>
        {icon}
        <strong className="grow">{title}</strong>
        <ChevronDown size={18} className="chev" aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.18s' }} />
      </button>
      {open ? children : null}
    </GlassPanel>
  )
}

const SubLink = ({ to, title }: { to: string; title: string }) => (
  <Link to={to} className="list-row" style={{ paddingLeft: 56 }}>
    <span className="grow">{title}</span>
  </Link>
)

/** The full-screen Menu opened from the profile's three-line button. */
export default function MenuPage() {
  const me = useMe()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const invite = async () => {
    try {
      await navigator.clipboard.writeText(appUrl('/signup'))
      toast.show('Invite link copied')
    } catch {
      toast.error('Could not copy the link.')
    }
  }
  const logOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <PageHeader title="Menu" back />
      <div className="stack">
        <GlassPanel as="section" aria-label="Your profile">
          <Link to={`/u/${me.username}`} className="settings-user">
            <Avatar src={me.avatar_url} name={me.display_name ?? me.username} size="lg" />
            <span className="grow" style={{ minWidth: 0 }}>
              <strong className="truncate" style={{ display: 'block', fontSize: 18 }}>{me.display_name || me.username}</strong>
              <span className="muted truncate" style={{ display: 'block' }}>View your profile</span>
            </span>
          </Link>
        </GlassPanel>

        <GlassPanel className="settings-list" as="nav" aria-label="Invite friends">
          <button type="button" className="list-row" onClick={() => void invite()} style={{ width: '100%', textAlign: 'left' }}>
            <Heart size={22} color="#ff3b5c" fill="#ff3b5c" aria-hidden />
            <strong className="grow">Invite friends</strong>
          </button>
        </GlassPanel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Tile to="/messages" icon={<MessageCircle size={28} />} label="Messages" color="#7a5cff" />
          <Tile to="/communities" icon={<Users size={28} />} label="Communities" color="#0a84ff" />
          <Tile to="/reels" icon={<Film size={28} />} label="Reels" color="#ff6a3d" />
          <Tile to="/saved" icon={<Bookmark size={28} />} label="Saved" color="#a35cff" />
          <Tile to="/discover" icon={<Compass size={28} />} label="Explore" color="#1db8a6" />
          <Tile to="/notifications" icon={<Bell size={28} />} label="Notifications" color="#f5a524" />
          <Tile to="/create" icon={<SquarePlus size={28} />} label="Create post" color="#0a84ff" />
          <Tile to="/settings/profile" icon={<Pencil size={28} />} label="Edit profile" color="#34c759" />
        </div>

        <Expand icon={<Settings size={22} aria-hidden />} title="Settings & privacy">
          <SubLink to="/settings" title="Settings & privacy" />
          <SubLink to="/settings/privacy" title="Privacy and security" />
          <SubLink to="/settings/blocked" title="Blocked accounts" />
          <SubLink to={`/settings/section/${sectionSlug('Preferences')}`} title="Language" />
          <SubLink to={`/settings/section/${sectionSlug('Themes')}`} title="Themes" />
          <SubLink to={`/settings/section/${sectionSlug('Notifications')}`} title="Notifications" />
        </Expand>

        <Expand icon={<HelpCircle size={22} aria-hidden />} title="Help & support">
          <SubLink to={`/settings/section/${sectionSlug('Support & Feedback')}`} title="Support & Feedback" />
          <SubLink to={`/settings/section/${sectionSlug('Help & Legal')}`} title="Help & Legal" />
        </Expand>

        <GlassPanel className="settings-list" as="nav" aria-label="Account">
          <Link to={`/settings/section/${sectionSlug('Add Account')}`} className="list-row">
            <UserPlus size={22} aria-hidden />
            <strong className="grow">Add account</strong>
          </Link>
          <button type="button" className="list-row" onClick={() => setConfirmLogout(true)} style={{ width: '100%', textAlign: 'left' }}>
            <LogOut size={22} aria-hidden />
            <strong className="grow">Log out</strong>
          </button>
        </GlassPanel>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You will be logged out of this account on this phone. Your account and data are not deleted."
        confirmLabel="Log out"
        onConfirm={logOut}
        onClose={() => setConfirmLogout(false)}
      />
    </>
  )
}
