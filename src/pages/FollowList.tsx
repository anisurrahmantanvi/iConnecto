import { useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { UserX, Users } from 'lucide-react'
import type { Page, ProfileLite } from '@/types/db'
import { UserList } from '@/components/profile/UserList'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { useAsync } from '@/hooks/common'
import { listFollowers, listFollowing } from '@/services/follows'
import { getProfileByUsername } from '@/services/profiles'

export default function FollowListPage({ kind }: { kind: 'followers' | 'following' }) {
  const { username = '' } = useParams()
  const navigate = useNavigate()
  const { data: profile, loading, error, reload } = useAsync(() => getProfileByUsername(username), [username])
  const profileId = profile?.id ?? null

  const fetchPage = useCallback(
    (cursor: string | null): Promise<Page<ProfileLite>> => {
      if (!profileId) return Promise.resolve({ items: [], nextCursor: null })
      return kind === 'followers' ? listFollowers(profileId, cursor) : listFollowing(profileId, cursor)
    },
    [kind, profileId],
  )

  return (
    <>
      <PageHeader title={profile ? (profile.display_name || `@${profile.username}`) : `@${username}`} back={`/u/${username}`} />
      <div className="stack">
        <Tabs
          label="Followers and following"
          value={kind}
          onChange={(next) => navigate(`/u/${username}/${next}`, { replace: true })}
          tabs={[
            { value: 'followers', label: 'Followers' },
            { value: 'following', label: 'Following' },
          ]}
        />
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !profile ? (
          <EmptyState
            icon={<UserX size={28} />}
            title="User not found"
            action={<Link to="/discover" className="btn btn--primary">Find people</Link>}
          />
        ) : (
          <UserList
            fetchPage={fetchPage}
            empty={{
              icon: <Users size={28} />,
              title: kind === 'followers' ? 'No followers yet' : 'Not following anyone yet',
              body: kind === 'followers' ? `When people follow @${profile.username}, they will show up here.` : `Accounts @${profile.username} follows will show up here.`,
            }}
          />
        )}
      </div>
    </>
  )
}
