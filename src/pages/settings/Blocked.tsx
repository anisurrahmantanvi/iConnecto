import { useState } from 'react'
import { UserX } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { UserRow } from '@/components/profile/UserList'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { listBlocked, unblockUser } from '@/services/moderation'

export default function BlockedPage() {
  const me = useMe()
  const toast = useToast()
  const { data, setData, loading, error, reload } = useAsync(() => listBlocked(me.id), [me.id])
  const [busyId, setBusyId] = useState<string | null>(null)

  const unblock = async (id: string, username: string) => {
    setBusyId(id)
    try {
      await unblockUser(me.id, id)
      setData((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
      toast.show(`Unblocked @${username}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader title="Blocked accounts" back="/settings/privacy" />
      {loading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<UserX size={28} />}
          title="You haven't blocked anyone"
          body="When you block someone, you stop seeing each other's posts and they can't message, call or follow you. You can block from a profile's menu."
        />
      ) : (
        <div className="glass" role="list" aria-label="Blocked accounts">
          {data.map((p) => (
            <div role="listitem" key={p.id}>
              <UserRow
                profile={p}
                right={
                  <Button variant="glass" size="sm" loading={busyId === p.id} onClick={() => void unblock(p.id, p.username)}>
                    Unblock
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
