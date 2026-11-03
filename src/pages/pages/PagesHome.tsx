import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag, Plus, Search } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ListSkeleton } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync, useDebounce } from '@/hooks/common'
import { compactNumber } from '@/lib/format'
import { categoryLabel, listDiscoverPages, listMyPages, type PageRow } from '@/services/pages'

function Row({ page, note }: { page: PageRow; note?: string }) {
  return (
    <Link to={`/page/${page.slug}`} className="list-row">
      <Avatar src={page.avatar_url} name={page.name} />
      <span className="grow">
        <strong className="truncate" style={{ display: 'block' }}>{page.name}</strong>
        <span className="small muted">{note ?? categoryLabel(page.category)} · {compactNumber(page.follower_count)} followers</span>
      </span>
    </Link>
  )
}

/** Your pages + discover pages. */
export default function PagesHomePage() {
  const me = useMe()
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const mine = useAsync(() => listMyPages(me.id), [me.id])
  const found = useAsync(() => listDiscoverPages(dq), [dq])
  const notInstalled = mine.data === null && !mine.loading

  return (
    <>
      <PageHeader title="Pages" back actions={<Link to="/pages/new" className="icon-btn" aria-label="Create page"><Plus size={22} /></Link>} />
      <div className="stack">
        {notInstalled ? (
          <GlassPanel padded><p className="small muted">Pages will be available after the next database update.</p></GlassPanel>
        ) : (
          <>
            <h2 className="section-title">Your pages</h2>
            {mine.loading ? <ListSkeleton rows={2} /> : null}
            {mine.data && !mine.data.length ? (
              <EmptyState icon={<Flag size={28} />} title="You have no pages yet" body="Make a page for yourself as a creator, or for your brand or shop." action={<Link to="/pages/new" className="btn btn--primary">Create a page</Link>} />
            ) : null}
            {mine.data?.length ? (
              <GlassPanel>{mine.data.map((r) => <Row key={r.page.id} page={r.page} note={r.role === 'owner' ? 'Owner' : r.role === 'admin' ? 'Admin' : 'Editor'} />)}</GlassPanel>
            ) : null}

            <h2 className="section-title">Discover pages</h2>
            <label className="glass row" style={{ padding: '10px 14px', borderRadius: 14 }}>
              <Search size={18} aria-hidden />
              <input className="grow" style={{ background: 'transparent', border: 0, outline: 0, font: 'inherit', color: 'inherit' }} placeholder="Search pages" aria-label="Search pages" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {found.loading ? <ListSkeleton rows={3} /> : null}
            {found.data && !found.data.length ? <p className="small muted">No pages found.</p> : null}
            {found.data?.length ? <GlassPanel>{found.data.map((p) => <Row key={p.id} page={p} />)}</GlassPanel> : null}
          </>
        )}
      </div>
    </>
  )
}
