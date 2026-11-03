import { PeerBadge } from '@/components/ui/PeerBadge'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { listChats } from '@/services/chat'
import { listArchivedIds, setArchived } from '@/services/chatPrefs'

export default function ArchivedChatsPage() {
  const toast = useToast()
  const { data, setData, loading, error, reload } = useAsync(async () => {
    const [chats, ids] = await Promise.all([listChats(), listArchivedIds()])
    const set = new Set(ids)
    return chats.filter((c) => set.has(c.chat_id))
  }, [])
  const [busy, setBusy] = useState<string | null>(null)

  const restore = async (id: string) => {
    setBusy(id)
    try {
      await setArchived(id, false)
      setData((prev) => (prev ? prev.filter((c) => c.chat_id !== id) : prev))
      toast.show('Moved back to Messages')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Archived chats" back="/message-settings" />
      {loading && !data ? (
        <ListSkeleton />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || !data.length ? (
        <EmptyState icon={<Archive size={28} />} title="No archived chats" body="Open a chat, tap the ⋯ menu and choose Archive to hide it from Messages." />
      ) : (
        <div className="glass" role="list">
          {data.map((c) => {
            const name = c.other_display_name || c.other_username
            return (
              <div key={c.chat_id} role="listitem" className="list-row">
                <Link to={`/messages/${c.chat_id}`} className="row grow" style={{ minWidth: 0 }}>
                  <Avatar src={c.other_avatar_url} name={name} />
                  <strong className="truncate">{name}</strong><PeerBadge userId={c.other_id} />
                </Link>
                <Button size="sm" variant="glass" loading={busy === c.chat_id} onClick={() => void restore(c.chat_id)}>Unarchive</Button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
