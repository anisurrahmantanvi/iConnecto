import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, ChevronRight, LogOut, UserPlus, UserRound, Users } from 'lucide-react'
import { useAuth, useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchBox } from '@/components/ui/SearchBox'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n'
import { SETTINGS_ICONS } from './settingsIcons'
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, sectionSlug } from './settingsMenu'

function Row({ to, icon, title, body, onTap }: { to?: string; icon?: ReactNode; title: string; body?: string; onTap?: () => void }) {
  const inner = (
    <>
      {icon}
      <span className="grow">
        <strong style={{ display: 'block' }}>{title}</strong>
        {body ? <span className="small muted" style={{ display: 'block' }}>{body}</span> : null}
      </span>
      <ChevronRight size={18} className="chev" aria-hidden />
    </>
  )
  return to ? (
    <Link to={to} className="list-row">{inner}</Link>
  ) : (
    <button type="button" className="list-row" onClick={onTap} style={{ width: '100%', textAlign: 'left' }}>{inner}</button>
  )
}

/** Settings & privacy: a search box, then groups with a short description, each section as an icon row that opens its own page. */
export default function SettingsHomePage() {
  const me = useMe()
  const { signOut } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [query, setQuery] = useState('')
  const soon = () => toast.show('Coming soon')

  const logOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) return []
    const out: { title: string; where: string; to?: string }[] = []
    for (const sec of SETTINGS_SECTIONS) {
      if (sec.title.toLowerCase().includes(q)) out.push({ title: sec.title, where: 'Settings', to: `/settings/section/${sectionSlug(sec.title)}` })
      for (const it of sec.items) {
        if (it.title.toLowerCase().includes(q)) out.push({ title: it.title, where: sec.title, to: it.to })
      }
    }
    return out.slice(0, 40)
  }, [q])

  return (
    <>
      <PageHeader title="Settings & privacy" back="/menu" />
      <div className="stack">
        <SearchBox value={query} onChange={setQuery} label="Search settings" />

        {q ? (
          results.length ? (
            <GlassPanel className="settings-list" as="nav" aria-label="Search results">
              {results.map((r, i) => (
                <Row key={`${r.where}-${r.title}-${i}`} to={r.to} onTap={soon} title={r.title} body={r.where} />
              ))}
            </GlassPanel>
          ) : (
            <p className="muted" style={{ textAlign: 'center' }}>No settings match “{query}”.</p>
          )
        ) : (
          <>
            <h2 className="section-title">Your account</h2>
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
            <GlassPanel className="settings-list" as="nav" aria-label="Shortcuts">
              <Row to="/settings/profile" icon={<UserRound size={22} aria-hidden />} title="Edit profile" />
              <Row to="/saved" icon={<Bookmark size={22} aria-hidden />} title={t('nav.saved')} />
              <Row to="/communities" icon={<Users size={22} aria-hidden />} title="Communities" />
            </GlassPanel>

            {SETTINGS_GROUPS.map((group) => (
              <section key={group.title} aria-label={group.title} className="stack">
                <div>
                  <h2 className="section-title" style={{ marginBottom: 2 }}>{group.title}</h2>
                  <p className="small muted" style={{ margin: '0 4px' }}>{group.caption}</p>
                </div>
                <GlassPanel className="settings-list" as="nav" aria-label={group.title}>
                  {group.sections.map((name) => {
                    const sec = SETTINGS_SECTIONS.find((x) => x.title === name)
                    if (!sec) return null
                    const Icon = SETTINGS_ICONS[sec.title]
                    return <Row key={sec.title} to={`/settings/section/${sectionSlug(sec.title)}`} icon={Icon ? <Icon size={22} aria-hidden /> : undefined} title={sec.title} />
                  })}
                </GlassPanel>
              </section>
            ))}

            <GlassPanel className="settings-list" as="nav" aria-label="Add account">
              <Row to={`/settings/section/${sectionSlug('Add Account')}`} icon={<UserPlus size={22} aria-hidden />} title="Add Account" />
            </GlassPanel>
            <Button variant="glass" block icon={<LogOut size={18} />} onClick={() => setConfirmLogout(true)}>{t('nav.logout')}</Button>
          </>
        )}
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
