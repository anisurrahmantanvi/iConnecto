import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, ChevronRight, LogOut, ShieldCheck, UserCog, UserX, UserRound } from 'lucide-react'
import { useAuth, useMe } from '@/app/AuthProvider'
import { useTheme, type ThemeMode } from '@/app/ThemeProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { LANGUAGES, useT } from '@/lib/i18n'
import { errorMessage } from '@/lib/supabase'

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

export default function SettingsHomePage() {
  const me = useMe()
  const { signOut } = useAuth()
  const { mode, setMode } = useTheme()
  const { t, lang, setLang } = useT()
  const navigate = useNavigate()
  const toast = useToast()

  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: t('settings.theme.system') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ]

  const logOut = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
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

        <h2 className="section-title">Account</h2>
        <GlassPanel className="settings-list" as="nav" aria-label="Account settings">
          <SettingsLink to="/settings/profile" icon={<UserRound size={22} aria-hidden />} title="Edit profile" body="Photo, name, username and bio" />
          <SettingsLink to="/saved" icon={<Bookmark size={22} aria-hidden />} title={t('nav.saved')} body="Posts you bookmarked" />
          <SettingsLink to="/settings/privacy" icon={<ShieldCheck size={22} aria-hidden />} title="Privacy and security" body="Password, devices, what others can see" />
          <SettingsLink to="/settings/blocked" icon={<UserX size={22} aria-hidden />} title="Blocked accounts" />
          <SettingsLink to="/settings/account" icon={<UserCog size={22} aria-hidden />} title="Account" body="Email address and account deletion" />
        </GlassPanel>

        <h2 className="section-title">{t('settings.appearance')}</h2>
        <GlassPanel padded className="col">
          <div role="group" aria-label={t('settings.appearance')} className="chip-row">
            {themes.map((th) => (
              <button key={th.value} type="button" className="chip" aria-pressed={mode === th.value} onClick={() => setMode(th.value)}>
                {th.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label={t('settings.language')} className="chip-row">
            {LANGUAGES.map((l) => (
              <button key={l.value} type="button" className="chip" aria-pressed={lang === l.value} onClick={() => setLang(l.value)}>
                {l.label}
              </button>
            ))}
          </div>
          <p className="small faint">Bengali currently covers navigation, sign-in and settings; other screens are in English.</p>
        </GlassPanel>

        <Button variant="glass" block icon={<LogOut size={18} />} onClick={() => void logOut()}>{t('nav.logout')}</Button>
      </div>
    </>
  )
}
