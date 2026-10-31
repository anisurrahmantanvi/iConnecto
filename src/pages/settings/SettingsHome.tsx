import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, ChevronRight, LogOut, UserPlus, UserRound, Users } from 'lucide-react'
import { useAuth, useMe } from '@/app/AuthProvider'
import { useTheme, type ThemeMode } from '@/app/ThemeProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { NotificationSetting } from '@/components/settings/NotificationSetting'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { LANGUAGES, useT } from '@/lib/i18n'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SETTINGS_SECTIONS } from './settingsMenu'

function SettingsLink({ to, icon, title, body }: { to: string; icon: ReactNode; title: string; body?: string }) {
  return (
    <Link to={to} className="list-row">
      {icon}
      <span className="grow">
        <strong style={{ display: 'block' }}>{title}</strong>
        {body ? <span className="small muted" style={{ display: 'block' }}>{body}</span> : null}
      </span>
      <ChevronRight size={18} className="chev" aria-hidden />
    </Link>
  )
}

function SoonRow({ icon, title, onTap, body }: { icon?: ReactNode; title: string; onTap: () => void; body?: string }) {
  return (
    <button type="button" className="list-row" onClick={onTap} style={{ width: '100%', textAlign: 'left' }}>
      {icon}
      <span className="grow">
        <strong style={{ display: 'block' }}>{title}</strong>
        {body ? <span className="small muted" style={{ display: 'block' }}>{body}</span> : null}
      </span>
      <ChevronRight size={18} className="chev" aria-hidden />
    </button>
  )
}

export default function SettingsHomePage() {
  const me = useMe()
  const { signOut } = useAuth()
  const { mode, setMode } = useTheme()
  const { t, lang, setLang } = useT()
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const soon = () => toast.show('Coming soon')

  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'System Default' },
    { value: 'light', label: 'Light Mode' },
    { value: 'dark', label: 'Dark Mode' },
  ]

  const logOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const section = (title: string, items: { title: string; to?: string }[]) => (
    <>
      <h2 className="section-title">{title}</h2>
      <GlassPanel className="settings-list" as="nav" aria-label={title}>
        {items.map((it) =>
          it.to ? <SettingsLink key={it.title} to={it.to} icon={null} title={it.title} /> : <SoonRow key={it.title} title={it.title} onTap={soon} />,
        )}
      </GlassPanel>
    </>
  )

  const [first, ...rest] = SETTINGS_SECTIONS
  const [audience, activity, security, help] = rest

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="stack">
        <GlassPanel as="section" aria-label="Your profile">
          <Link to={`/u/${me.username}`} className="settings-user">
            <Avatar src={me.avatar_url} name={me.display_name ?? me.username} size="lg" />
            <span className="grow" style={{ minWidth: 0 }}>
              <strong className="truncate" style={{ display: 'block', fontSize: 18 }}>{me.display_name || me.username}</strong>
              <span className="muted truncate" style={{ display: 'block' }}>@{me.username}</span>
            </span>
            <ChevronRight size={18} className="chev" aria-hidden />
          </Link>
        </GlassPanel>

        <h2 className="section-title">Shortcuts</h2>
        <GlassPanel className="settings-list" as="nav" aria-label="Shortcuts">
          <SettingsLink to="/settings/profile" icon={<UserRound size={22} aria-hidden />} title="Edit profile" />
          <SettingsLink to="/saved" icon={<Bookmark size={22} aria-hidden />} title={t('nav.saved')} />
          <SettingsLink to="/communities" icon={<Users size={22} aria-hidden />} title="Communities" />
        </GlassPanel>

        {section(first.title, first.items)}

        <h2 className="section-title">Preferences</h2>
        <GlassPanel padded className="col">
          <strong>Language</strong>
          <div role="group" aria-label={t('settings.language')} className="chip-row">
            {LANGUAGES.map((l) => (
              <button key={l.value} type="button" className="chip" aria-pressed={lang === l.value} onClick={() => setLang(l.value)}>
                {l.label}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={false} onClick={soon}>हिन्दी</button>
          </div>
          <p className="small faint">Bengali currently covers navigation, sign-in and settings; other screens are in English.</p>
        </GlassPanel>
        <GlassPanel className="settings-list" as="nav" aria-label="Media">
          <SoonRow title="Media: Data Saver" onTap={soon} />
        </GlassPanel>

        {section(audience.title, audience.items)}
        {section(activity.title, activity.items)}

        <h2 className="section-title">Themes</h2>
        <GlassPanel padded className="col">
          <div role="group" aria-label="Themes" className="chip-row">
            {themes.map((th) => (
              <button key={th.value} type="button" className="chip" aria-pressed={mode === th.value} onClick={() => setMode(th.value)}>
                {th.label}
              </button>
            ))}
          </div>
        </GlassPanel>

        {section(security.title, security.items)}

        <h2 className="section-title">Notifications</h2>
        <NotificationSetting />
        <GlassPanel className="settings-list" as="nav" aria-label="More notifications">
          <SoonRow title="In-App Notifications" onTap={soon} />
          <SoonRow title="Email Notifications" onTap={soon} />
        </GlassPanel>

        {section(help.title, help.items)}

        <h2 className="section-title">Add Account & Logout</h2>
        <GlassPanel className="settings-list" as="nav" aria-label="Accounts">
          <SoonRow icon={<UserPlus size={22} aria-hidden />} title="Add Account" onTap={soon} />
        </GlassPanel>
        <Button variant="glass" block icon={<LogOut size={18} />} onClick={() => setConfirmLogout(true)}>{t('nav.logout')}</Button>
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
