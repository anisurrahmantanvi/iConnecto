import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, ChevronRight, LogOut, UserRound, Users } from 'lucide-react'
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

  const [open, setOpen] = useState<string | null>(null)

  const inline = (kind: 'language' | 'themes' | 'push' | undefined) => {
    if (kind === 'language')
      return (
        <div className="col" style={{ padding: '4px 16px 12px' }}>
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
        </div>
      )
    if (kind === 'themes')
      return (
        <div role="group" aria-label="Themes" className="chip-row" style={{ padding: '4px 16px 12px' }}>
          {themes.map((th) => (
            <button key={th.value} type="button" className="chip" aria-pressed={mode === th.value} onClick={() => setMode(th.value)}>
              {th.label}
            </button>
          ))}
        </div>
      )
    if (kind === 'push') return <div style={{ padding: '4px 12px 12px' }}><NotificationSetting /></div>
    return null
  }

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

        <h2 className="section-title">All settings</h2>
        {SETTINGS_SECTIONS.map((sec) => {
          const isOpen = open === sec.title
          return (
            <GlassPanel key={sec.title} className="settings-list" as="section" aria-label={sec.title}>
              <button
                type="button"
                className="list-row"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : sec.title)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <strong className="grow">{sec.title}</strong>
                <ChevronRight size={18} className="chev" aria-hidden style={{ transform: isOpen ? 'rotate(90deg)' : undefined, transition: 'transform 0.18s' }} />
              </button>
              {isOpen ? (
                <>
                  {inline(sec.inline)}
                  {sec.items.map((it) =>
                    it.to ? <SettingsLink key={it.title} to={it.to} icon={null} title={it.title} /> : <SoonRow key={it.title} title={it.title} onTap={soon} />,
                  )}
                  {sec.title === 'Add Account & Logout' ? (
                    <div style={{ padding: '8px 16px 16px' }}>
                      <Button variant="glass" block icon={<LogOut size={18} />} onClick={() => setConfirmLogout(true)}>{t('nav.logout')}</Button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </GlassPanel>
          )
        })}

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
