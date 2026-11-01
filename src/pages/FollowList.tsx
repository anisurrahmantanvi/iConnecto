import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserX, Users } from 'lucide-react'
import type { Page, ProfileLite } from '@/types/db'
import { UserList } from '@/components/profile/UserList'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/common'
import { listFriends } from '@/services/friends'
import { getProfileByUsername } from '@/services/profiles'

/** A person's friends (also reached from the old followers / following links). */
export default function FriendsListPage() {
  const { username = '' } = useParams()
  const { data: profile, loading, error, reload } = useAsync(() => getProfileByUsername(username), [username])
  const profileId = profile?.id ?? null

  const fetchPage = useCallback(
    (cursor: string | null): Promise<Page<ProfileLite>> =>
      profileId ? listFriends(profileId, cursor) : Promise.resolve({ items: [], nextCursor: null }),
    [profileId],
  )

  return (
    <>
      <PageHeader title={profile ? (profile.display_name || `@${profile.username}`) : `@${username}`} back={`/u/${username}`} />
      <div className="stack">
        <h2 className="section-title">Friends</h2>
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !profile ? (
          <EmptyState icon={<UserX size={28} />} title="User not found" action={<Link to="/discover" className="btn btn--primary">Find people</Link>} />
        ) : (
          <UserList
            fetchPage={fetchPage}
            empty={{ icon: <Users size={28} />, title: 'No friends yet', body: `When @${profile.username} makes friends, they will show up here.` }}
          />
        )}
      </div>
    </>
  )
}
