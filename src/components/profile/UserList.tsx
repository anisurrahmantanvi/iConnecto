import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { Link } from 'react-router-dom'
import type { Page, ProfileLite } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton, Spinner } from '@/components/ui/Feedback'
import { useInfiniteSentinel, usePaged } from '@/hooks/common'
import { followingAmong } from '@/services/follows'
import { FollowButton } from './FollowButton'

interface UserListProps {
  /** Must be stable (useCallback); a new function reloads the list. */
  fetchPage: (cursor: string | null) => Promise<Page<ProfileLite>>
  empty: { icon?: ReactNode; title: string; body?: string }
  showFollow?: boolean
  /** Extra control on the right of each row (for example "Unblock"). */
  renderAction?: (p: ProfileLite) => ReactNode
}

export function UserRow({ profile, right }: { profile: ProfileLite; right?: ReactNode }) {
  return (
    <div className="list-row">
      <Link to={`/u/${profile.username}`} aria-label={`Open ${profile.display_name ?? profile.username}`}>
        <Avatar src={profile.avatar_url} name={profile.display_name ?? profile.username} />
      </Link>
      <Link to={`/u/${profile.username}`} className="grow user-link">
        <strong className="truncate" style={{ display: 'block' }}>{profile.display_name || profile.username}<VerifiedBadge badge={profile.badge} size={14} /></strong>
        <span className="small muted truncate" style={{ display: 'block' }}>@{profile.username}</span>
      </Link>
      {right}
    </div>
  )
}

/** Paginated list of people with optional follow buttons (one extra query per page for follow state). */
export function UserList({ fetchPage, empty, showFollow = true, renderAction }: UserListProps) {
  const me = useMe()
  const { items, loading, loadingMore, error, hasMore, loadMore, reload } = usePaged<ProfileLite>(fetchPage)
  const sentinel = useInfiniteSentinel(loadMore, hasMore && !loadingMore && !error)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const known = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!showFollow) return
    const fresh = items.map((p) => p.id).filter((id) => id !== me.id && !known.current.has(id))
    if (!fresh.length) return
    fresh.forEach((id) => known.current.add(id))
    let cancelled = false
    followingAmong(me.id, fresh)
      .then((set) => !cancelled && setFollowing((prev) => new Set([...prev, ...set])))
      .catch(() => undefined) // buttons simply show "Follow"; the server still rejects duplicates
    return () => {
      cancelled = true
    }
  }, [items, me.id, showFollow])

  const setOne = useCallback((id: string, on: boolean) => {
    setFollowing((prev) => {
      const n = new Set(prev)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  }, [])

  if (loading) return <ListSkeleton />
  if (error && !items.length) return <ErrorState message={error} onRetry={reload} />
  if (!items.length) return <EmptyState {...empty} />

  return (
    <div className="col">
      <div className="glass">
        {items.map((p) => (
          <UserRow
            key={p.id}
            profile={p}
            right={
              renderAction ? renderAction(p) : showFollow ? (
                <FollowButton targetId={p.id} following={following.has(p.id)} onChange={(on) => setOne(p.id, on)} />
              ) : null
            }
          />
        ))}
      </div>
      {loadingMore ? <Spinner label="Loading more people" /> : null}
      {error ? <ErrorState message={error} onRetry={loadMore} /> : null}
      {hasMore && !loadingMore && !error ? (
        <div ref={sentinel} className="center"><Button variant="ghost" size="sm" onClick={loadMore}>Load more</Button></div>
      ) : null}
    </div>
  )
}
