import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProfileLite } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { UserRow } from '@/components/profile/UserList'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { SearchBox } from '@/components/ui/SearchBox'
import { useToast } from '@/components/ui/Toast'
import { useAsync, useDebounce } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { getOrCreateDm } from '@/services/chat'
import { searchProfiles } from '@/services/profiles'

/** Search for a person and open (or create) the one-to-one conversation with them. */
export function NewChatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 350)
  const [starting, setStarting] = useState<string | null>(null)
  const ready = dq.trim().length >= 2

  const results = useAsync<ProfileLite[]>(
    () => (ready ? searchProfiles(dq, null).then((p) => p.items.filter((u) => u.id !== me.id)) : Promise.resolve([])),
    [dq, ready, me.id],
  )

  const start = async (user: ProfileLite) => {
    setStarting(user.id)
    try {
      const chatId = await getOrCreateDm(user.id)
      onClose()
      navigate(`/messages/${chatId}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setStarting(null)
    }
  }

  return (
    <Dialog open={open} title="New message" onClose={onClose}>
      <div className="col">
        <SearchBox label="Search people by name or username" value={q} onChange={setQ} autoFocus />
        {!ready ? (
          <p className="small muted">Type at least two characters to search.</p>
        ) : results.loading ? (
          <ListSkeleton rows={3} />
        ) : results.error ? (
          <ErrorState message={results.error} onRetry={results.reload} />
        ) : !results.data || !results.data.length ? (
          <p className="small muted">No people found.</p>
        ) : (
          <div className="glass">
            {results.data.map((u) => (
              <UserRow
                key={u.id}
                profile={u}
                right={
                  <Button size="sm" variant="primary" loading={starting === u.id} disabled={starting !== null} onClick={() => void start(u)}>
                    Message
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  )
}
