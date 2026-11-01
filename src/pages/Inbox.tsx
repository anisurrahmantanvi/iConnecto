import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessageCircle, Plus, Settings } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { NewChatDialog } from '@/components/chat/NewChatDialog'
import { PresenceAvatar } from '@/components/ui/PresenceAvatar'
import { Button, IconButton } from '@/components/ui/Button'
import { RichText } from '@/components/ui/Emoji'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/common'
import { usePresence } from '@/hooks/presence'
import { describePresence } from '@/lib/presence'
import { timeAgo } from '@/lib/format'
import { listChats, listMessageRequestIds, subscribeAnyMessage } from '@/services/chat'

export default function InboxPage() {
  const me = useMe()
  const { data: all, loading, error, reload } = useAsync(listChats, [])
  const { data: reqIds } = useAsync(listMessageRequestIds, [all])
  const [params] = useSearchParams()
  const showRequests = params.get('requests') === '1'
  const reqSet = new Set(reqIds ?? [])
  const requestCount = (all ?? []).filter((c) => reqSet.has(c.chat_id)).length
  const data = all ? all.filter((c) => reqSet.has(c.chat_id) === showRequests) : all
  const [composing, setComposing] = useState(false)
  const presenceMap = usePresence((data ?? []).map((c) => c.other_id))
  const timer = useRef<number | null>(null)

  // Refresh when a message arrives. Bursts are coalesced so a busy chat doesn't cause a query per message.
  useEffect(() => {
    const off = subscribeAnyMessage(me.id, () => {
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(reload, 500)
    })
    return () => {
      off()
      if (timer.current) window.clearTimeout(timer.current)
    }
    // `reload` is recreated every render; the subscription only needs the latest call, not a resubscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id])

  return (
    <>
      <PageHeader
        title={showRequests ? 'Message requests' : 'Messages'}
        back={showRequests ? '/messages' : '/'}
        actions={
          <span className="page-header__actions">
            <Link to="/message-settings" className="icon-btn" aria-label="Message settings"><Settings size={22} /></Link>
            <IconButton label="New message" onClick={() => setComposing(true)}><Plus size={22} /></IconButton>
          </span>
        }
      />

      {!showRequests && requestCount > 0 ? (
        <Link to="/messages?requests=1" className="list-row list-row--link glass">
          <strong className="grow">Message requests</strong>
          <span className="count-pill">{requestCount}</span>
        </Link>
      ) : null}

      {loading && !data ? (
        <ListSkeleton />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || !data.length ? (
        <EmptyState
          icon={<MessageCircle size={28} />}
          title="No conversations yet"
          body="Message a friend to get started. Conversations are private between you and them."
          action={<Button variant="primary" onClick={() => setComposing(true)}>New message</Button>}
        />
      ) : (
        <div className="glass" role="list" aria-label="Conversations">
          {data.map((c) => {
            const name = c.other_display_name || c.other_username
            return (
              <Link
                key={c.chat_id}
                to={`/messages/${c.chat_id}`}
                role="listitem"
                className={`list-row list-row--link ${c.unread_count > 0 ? 'list-row--unread' : ''}`}
                aria-label={`${name}${c.unread_count ? `, ${c.unread_count} unread` : ''}`}
              >
                <PresenceAvatar online={!!describePresence(presenceMap.get(c.other_id))?.online} src={c.other_avatar_url} name={name} size="lg" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row">
                    <strong className="truncate grow">{name}</strong>
                    <span className="small faint">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <div className="row">
                    <span className="small muted chat-preview grow">
                      {c.last_message_preview ? <RichText text={c.last_message_preview} plain /> : 'Say hello 👋'}
                    </span>
                    {c.unread_count > 0 ? (
                      <span className="count-pill" aria-hidden>{c.unread_count > 99 ? '99+' : c.unread_count}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <NewChatDialog open={composing} onClose={() => setComposing(false)} />
    </>
  )
}
