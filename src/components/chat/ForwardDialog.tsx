import { PeerBadge } from '@/components/ui/PeerBadge'
import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { listChats, sendMessage } from '@/services/chat'

/** Pick one of your chats to forward a message to. */
export function ForwardDialog({ content, onClose }: { content: string | null; onClose: () => void }) {
  const open = content !== null
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const { data, loading, error, reload } = useAsync(() => (open ? listChats() : Promise.resolve([])), [open])

  const forward = async (chatId: string, name: string) => {
    if (!content || busy) return
    setBusy(chatId)
    try {
      await sendMessage(chatId, content, true)
      toast.show(`Forwarded to ${name}`)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} title="Forward to" onClose={onClose}>
      {loading && !data ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || !data.length ? (
        <EmptyState title="No chats yet" body="Start a conversation first, then you can forward messages to it." />
      ) : (
        <div role="list" style={{ maxHeight: '50dvh', overflowY: 'auto' }}>
          {data.map((c) => {
            const name = c.other_display_name || c.other_username
            return (
              <button key={c.chat_id} type="button" role="listitem" className="list-row" disabled={busy !== null} onClick={() => void forward(c.chat_id, name)} style={{ width: '100%', textAlign: 'left' }}>
                <Avatar src={c.other_avatar_url} name={name} />
                <strong className="truncate">{name}</strong><PeerBadge userId={c.other_id} /><span className="grow" />
                <span className="small muted">{busy === c.chat_id ? 'Sending…' : 'Send'}</span>
              </button>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}
