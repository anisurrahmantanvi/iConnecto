import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { CommunityList } from '@/components/communities/CommunityList'
import { CommunityRow } from '@/components/communities/CommunityRow'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchBox } from '@/components/ui/SearchBox'
import { Tabs } from '@/components/ui/Tabs'
import { useAsync, useDebounce } from '@/hooks/common'
import { myCommunities } from '@/services/communities'

type Tab = 'discover' | 'mine'

/** Communities the signed-in user belongs to. Mounted only while its tab is open, so it costs nothing otherwise. */
function MyCommunities() {
  const me = useMe()
  const { data, loading, error, reload } = useAsync(() => myCommunities(me.id), [me.id])

  if (loading) return <ListSkeleton />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Users size={28} />}
        title="You haven't joined any communities"
        body="Join one from the Discover tab, or start your own."
        action={<Link to="/communities/new" className="btn btn--primary"><Plus size={16} aria-hidden /> Create a community</Link>}
      />
    )
  }
  return (
    <div className="glass">
      {data.map((c) => <CommunityRow key={c.id} community={c} />)}
    </div>
  )
}

export default function CommunitiesPage() {
  const [tab, setTab] = useState<Tab>('discover')
  const [q, setQ] = useState('')
  const debounced = useDebounce(q, 350)

  return (
    <>
      <PageHeader
        title="Communities"
        actions={
          <Link to="/communities/new" className="icon-btn" aria-label="Create a community" title="Create a community">
            <Plus size={22} />
          </Link>
        }
      />
      <div className="stack">
        <Tabs
          label="Community lists"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'discover', label: 'Discover' },
            { value: 'mine', label: 'My communities' },
          ]}
        />
        {tab === 'discover' ? (
          <>
            <SearchBox label="Search communities" placeholder="Search communities" value={q} onChange={setQ} />
            <CommunityList
              query={debounced}
              emptyAction={<Link to="/communities/new" className="btn btn--primary"><Plus size={16} aria-hidden /> Create a community</Link>}
            />
          </>
        ) : (
          <MyCommunities />
        )}
      </div>
    </>
  )
}
