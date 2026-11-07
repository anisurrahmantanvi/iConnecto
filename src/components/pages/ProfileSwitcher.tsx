import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/Dialog'
import { setActingAs, useActingAs } from '@/lib/actingAs'
import { listMyPages, type PageRole, type PageRow } from '@/services/pages'

/** "Switch profile": choose between your own profile and the Pages you manage. */
export function ProfileSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe()
  const navigate = useNavigate()
  const acting = useActingAs()
  const [pages, setPages] = useState<{ page: PageRow; role: PageRole }[] | null | undefined>(undefined)
  useEffect(() => {
    if (!open) return
    let off = false
    void listMyPages(me.id).then((r) => { if (!off) setPages(r) }).catch(() => { if (!off) setPages(null) })
    return () => { off = true }
  }, [open, me.id])

  const choose = (slug: string) => {
    setActingAs(slug)
    onClose()
    if (slug) navigate(`/page/${slug}`)
  }
  const row = (key: string, name: string, sub: string, src: string | null, on: boolean, slug: string) => (
    <button key={key} type="button" className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => choose(slug)}>
      <Avatar src={src} name={name} size="md" />
      <span className="grow" style={{ minWidth: 0 }}><strong className="truncate" style={{ display: 'block' }}>{name}</strong><span className="small muted">{sub}</span></span>
      {on ? <Check size={20} aria-label="Active" /> : null}
    </button>
  )
  return (
    <Dialog open={open} title="Switch profile" onClose={onClose}>
      <div className="stack" style={{ gap: 4 }}>
        {row('me', me.display_name || me.username, 'Your profile', me.avatar_url, !acting, '')}
        {(pages ?? []).map(({ page, role }) => row(page.id, page.name, `Page · ${role}`, page.avatar_url, acting === page.slug, page.slug))}
        {pages === undefined ? <p className="small muted">Loading your pages…</p> : null}
        {pages === null ? <p className="small muted">Pages will be available after the next database update.</p> : null}
        {pages && !pages.length ? <p className="small muted">You do not manage any Page yet.</p> : null}
        <button type="button" className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => { onClose(); navigate('/pages/new') }}>
          <Plus size={20} aria-hidden /><strong className="grow">Create a new Page</strong>
        </button>
      </div>
    </Dialog>
  )
}
