import { useCallback, type ReactNode } from 'react'
import { Users } from 'lucide-react'
import type { Community } from '@/types/db'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton, Spinner } from '@/components/ui/Feedback'
import { useInfiniteSentinel, usePaged } from '@/hooks/common'
import { listCommunities } from '@/services/communities'
import { CommunityRow } from './CommunityRow'

/** Paginated community directory with optional name search. */
export function CommunityList({ query, emptyAction }: { query: string; emptyAction?: ReactNode }) {
  const fetchPage = useCallback((cursor: string | null) => listCommunities(query, cursor), [query])
  const { items, loading, loadingMore, error, hasMore, loadMore, reload } = usePaged<Community>(fetchPage)
  const sentinel = useInfiniteSentinel(loadMore, hasMore && !loadingMore && !error)

  if (loading) return <ListSkeleton />
  if (error && !items.length) return <ErrorState message={error} onRetry={reload} />
  if (!items.length) {
    return (
      <EmptyState
        icon={<Users size={28} />}
        title={query.trim().length >= 2 ? 'No communities found' : 'No communities yet'}
        body={query.trim().length >= 2 ? 'Try a different name.' : 'Start the first one and invite people.'}
        action={emptyAction}
      />
    )
  }
  return (
    <div className="col">
      <div className="glass">
        {items.map((c) => <CommunityRow key={c.id} community={c} />)}
      </div>
      {loadingMore ? <Spinner label="Loading more communities" /> : null}
      {error ? <ErrorState message={error} onRetry={loadMore} /> : null}
      {hasMore && !loadingMore && !error ? (
        <div ref={sentinel} className="center"><Button variant="ghost" size="sm" onClick={loadMore}>Load more</Button></div>
      ) : null}
    </div>
  )
}
