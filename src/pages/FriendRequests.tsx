import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { listFriendRequests, respondFriendRequest } from '@/services/friends'

/** People who sent you a friend request. */
export default function FriendRequestsPage() {
  const me = useMe()
  const toast = useToast()
  const { data, setData, loading, error, reload } = useAsync(() => listFriendRequests(me.id), [me.id])
  const [busy, setBusy] = useState<string | null>(null)

  const answer = async (id: string, accept: boolean) => {
    setBusy(id)
    try {
      await respondFriendRequest(id, accept)
      setData((prev) => (prev ? prev.filter((r) => r.requester.id !== id) : prev))
      toast.show(accept ? 'You are now friends' : 'Request declined')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Friend requests" back="/notifications" />
      {loading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={<Lock size={28} />} title="No requests" body="When someone sends you a friend request, you can accept it here." />
      ) : (
        <GlassPanel className="settings-list" as="section" aria-label="Friend requests">
          {data.map(({ requester }) => (
            <div key={requester.id} className="list-row">
              <Link to={`/u/${requester.username}`} aria-label={`Open ${requester.display_name ?? requester.username}`}>
                <Avatar src={requester.avatar_url} name={requester.display_name ?? requester.username} />
              </Link>
              <span className="grow" style={{ minWidth: 0 }}>
                <strong className="truncate" style={{ display: 'block' }}>{requester.display_name || requester.username}<VerifiedBadge badge={requester.badge} size={14} /></strong>
                <span className="small muted truncate" style={{ display: 'block' }}>@{requester.username}</span>
              </span>
              <Button variant="primary" size="sm" loading={busy === requester.id} onClick={() => void answer(requester.id, true)}>Accept</Button>
              <Button variant="glass" size="sm" disabled={busy === requester.id} onClick={() => void answer(requester.id, false)}>Decline</Button>
            </div>
          ))}
        </GlassPanel>
      )}
    </>
  )
}
