import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Sparkles, Users } from 'lucide-react'
import type { Page, ProfileLite } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { CommunityList } from '@/components/communities/CommunityList'
import { PostFeed } from '@/components/feed/PostFeed'
import { UserList } from '@/components/profile/UserList'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchBox } from '@/components/ui/SearchBox'
import { Tabs } from '@/components/ui/Tabs'
import { useDebounce } from '@/hooks/common'
import { searchProfiles, suggestedProfiles } from '@/services/profiles'

type Tab = 'people' | 'posts' | 'communities'

export default function DiscoverPage() {
  const me = useMe()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const rawTab = params.get('tab')
  const tab: Tab = rawTab === 'posts' || rawTab === 'communities' ? rawTab : 'people'
  const dq = useDebounce(q, 350)
  const searching = dq.trim().length >= 2

  // Keep the URL in step with the (debounced) query so Back returns to the same search. Skip when already equal,
  // which also prevents a navigation loop.
  useEffect(() => {
    if ((params.get('q') ?? '') === dq) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (dq) next.set('q', dq)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq])

  const setTab = (next: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'people') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )

  const peoplePage = useCallback(
    async (cursor: string | null): Promise<Page<ProfileLite>> => {
      if (searching) return searchProfiles(dq, cursor)
      return { items: await suggestedProfiles(me.id, 12), nextCursor: null }
    },
    [searching, dq, me.id],
  )

  return (
    <>
      <PageHeader title="Discover" />
      <div className="stack">
        <SearchBox
          label="Search people, posts and communities"
          placeholder="Search"
          value={q}
          onChange={setQ}
        />
        <Tabs
          label="Discover sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'people', label: 'People' },
            { value: 'posts', label: 'Posts' },
            { value: 'communities', label: 'Communities' },
          ]}
        />

        {tab === 'people' ? (
          <>
            {!searching ? <h2 className="section-title">Suggested for you</h2> : null}
            <UserList
              fetchPage={peoplePage}
              empty={{
                icon: <Users size={28} />,
                title: searching ? 'No people found' : 'No suggestions yet',
                body: searching ? 'Check the spelling or try a different name.' : 'Invite friends to join, or search for someone by name.',
              }}
            />
          </>
        ) : null}

        {tab === 'posts' ? (
          <PostFeed
            source={searching ? { kind: 'search', query: dq } : { kind: 'discover' }}
            empty={{
              icon: <Sparkles size={28} />,
              title: searching ? 'No posts found' : 'Nothing to discover yet',
              body: searching ? 'Try different words.' : 'New posts from the community will show up here.',
            }}
          />
        ) : null}

        {tab === 'communities' ? (
          <CommunityList
            query={dq}
            emptyAction={<Link to="/communities/new" className="btn btn--primary"><Plus size={16} aria-hidden /> Create a community</Link>}
          />
        ) : null}
      </div>
    </>
  )
}
