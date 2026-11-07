import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { setActingAs, useActingAs } from '@/lib/actingAs'
import { getPageBySlug, myPageRole, type PageRow } from '@/services/pages'
import { ProfileSwitcher } from './ProfileSwitcher'

/** Shown on every screen while you are acting as a Page. */
export function ActingBanner() {
  const me = useMe()
  const slug = useActingAs()
  const [page, setPage] = useState<PageRow | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setPage(null)
    if (!slug) return
    let off = false
    void (async () => {
      try {
        const p = await getPageBySlug(slug)
        const role = p ? await myPageRole(p.id, me.id) : null
        if (off) return
        if (p && role) setPage(p)
        else setActingAs('') // the page is gone or you no longer manage it
      } catch { /* offline: keep the banner hidden */ }
    })()
    return () => { off = true }
  }, [slug, me.id])
  if (!slug || !page) return <ProfileSwitcher open={open} onClose={() => setOpen(false)} />
  return (
    <>
      <div className="acting-banner" role="status">
        <Avatar src={page.avatar_url} name={page.name} size="sm" />
        <Link to={`/page/${page.slug}`} className="acting-banner__name truncate">Acting as <strong>{page.name}</strong></Link>
        <button type="button" className="btn btn--sm" onClick={() => setOpen(true)}>Switch</button>
        <button type="button" className="btn btn--sm" onClick={() => setActingAs('')}>My profile</button>
      </div>
      <ProfileSwitcher open={open} onClose={() => setOpen(false)} />
    </>
  )
}
