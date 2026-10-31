import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/app/ThemeProvider'
import { NotificationSetting } from '@/components/settings/NotificationSetting'
import { EmptyState } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { LANGUAGES, useT } from '@/lib/i18n'
import { SETTINGS_SECTIONS, sectionSlug } from './settingsMenu'

/** One settings section: its ready-made control (language, themes, push) and its list of items. */
export default function SettingsSectionPage() {
  const { slug = '' } = useParams()
  const toast = useToast()
  const { mode, setMode } = useTheme()
  const { t, lang, setLang } = useT()
  const sec = SETTINGS_SECTIONS.find((s) => sectionSlug(s.title) === slug)
  const soon = () => toast.show('Coming soon')

  if (!sec) {
    return (
      <>
        <PageHeader title="Settings" back="/settings" />
        <EmptyState title="Not found" body="This settings page does not exist." />
      </>
    )
  }

  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'System Default' },
    { value: 'light', label: 'Light Mode' },
    { value: 'dark', label: 'Dark Mode' },
  ]

  return (
    <>
      <PageHeader title={sec.title} back="/settings" />
      <div className="stack">
        {sec.inline === 'language' ? (
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
        ) : null}
        {sec.inline === 'themes' ? (
          <GlassPanel padded className="col">
            <div role="group" aria-label="Themes" className="chip-row">
              {themes.map((th) => (
                <button key={th.value} type="button" className="chip" aria-pressed={mode === th.value} onClick={() => setMode(th.value)}>
                  {th.label}
                </button>
              ))}
            </div>
          </GlassPanel>
        ) : null}
        {sec.inline === 'push' ? <NotificationSetting /> : null}

        {sec.items.length ? (
          <GlassPanel className="settings-list" as="nav" aria-label={sec.title}>
            {sec.items.map((it) =>
              it.to ? (
                <Link key={it.title} to={it.to} className="list-row">
                  <strong className="grow">{it.title}</strong>
                  <ChevronRight size={18} className="chev" aria-hidden />
                </Link>
              ) : (
                <button key={it.title} type="button" className="list-row" onClick={soon} style={{ width: '100%', textAlign: 'left' }}>
                  <strong className="grow">{it.title}</strong>
                  <ChevronRight size={18} className="chev" aria-hidden />
                </button>
              ),
            )}
          </GlassPanel>
        ) : null}
      </div>
    </>
  )
}
