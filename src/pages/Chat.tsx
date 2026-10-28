import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Flag, MessageCircle, Phone, Send, Trash2, UserRound, Video, WifiOff } from 'lucide-react'
import type { Message } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { useBadges } from '@/app/BadgesProvider'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RichText } from '@/components/ui/Emoji'
import { EmojiButton } from '@/components/ui/EmojiButton'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { usePaged, useAsync } from '@/hooks/common'
import { insertAtCaret, restoreCaret, useAutosize } from '@/hooks/ui'
import { clockTime } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import {
  deleteMessage,
  fetchMessages,
  getChatPeer,
  markChatRead,
  MAX_MESSAGE_LENGTH,
  sendMessage,
  subscribeChat,
} from '@/services/chat'

interface Pending {
  tempId: string
  content: string
  created_at: string
  failed: boolean
}

type Live = 'connecting' | 'live' | 'down'

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export default function ChatPage() {
  const { chatId = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const { refreshMessages } = useBadges()

  const peerState = useAsync(() => getChatPeer(chatId), [chatId])
  const peer = peerState.data

  const fetchPage = useCallback((cursor: string | null) => fetchMessages(chatId, cursor), [chatId])
  const { items, loading, loadingMore, error, hasMore, loadMore, reload, setItems } = usePaged<Message>(fetchPage, !!peer)

  const [pending, setPending] = useState<Pending[]>([])
  const [text, setText] = useState('')
  const [live, setLive] = useState<Live>('connecting')
  const [toDelete, setToDelete] = useState<Message | null>(null)

  const scroller = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)
  const heightBeforeOlder = useRef<number | null>(null)
  useAutosize(area, text, 120)

  const meId = me.id
  const markRead = useCallback(() => {
    markChatRead(chatId).then(refreshMessages).catch(() => undefined)
  }, [chatId, refreshMessages])

  // Latest handlers in a ref so the realtime subscription is created once per chat instead of on every render.
  const handlers = useRef({ markRead, reload })
  handlers.current = { markRead, reload }

  useEffect(() => {
    if (!peer) return
    handlers.current.markRead()
    let wasDown = false
    const off = subscribeChat(
      chatId,
      (m) => {
        setItems((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]))
        if (m.sender_id === meId) {
          // Our own message echoed back: drop its "sending" placeholder (first one with the same text).
          setPending((prev) => {
            const i = prev.findIndex((p) => !p.failed && p.content === m.content)
            return i === -1 ? prev : prev.filter((_, j) => j !== i)
          })
        } else {
          handlers.current.markRead()
        }
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          setLive('live')
          // After an outage, fetch what we missed while the socket was down.
          if (wasDown) handlers.current.reload()
          wasDown = false
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDown = true
          setLive('down')
        }
      },
    )
    const onOnline = () => handlers.current.reload()
    window.addEventListener('online', onOnline)
    return () => {
      off()
      window.removeEventListener('online', onOnline)
    }
  }, [chatId, meId, peer, setItems])

  // Keep the view pinned to the newest message, but never yank the reader away from older history.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (heightBeforeOlder.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current
      heightBeforeOlder.current = null
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [items.length, pending.length, loading])

  const onScroll = () => {
    const el = scroller.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const loadOlder = () => {
    heightBeforeOlder.current = scroller.current?.scrollHeight ?? null
    loadMore()
  }

  const send = async (content: string, retryId?: string) => {
    const body = content.trim()
    if (!body) return
    const tempId = retryId ?? `tmp-${crypto.randomUUID()}`
    stickToBottom.current = true
    setPending((prev) =>
      retryId
        ? prev.map((p) => (p.tempId === tempId ? { ...p, failed: false } : p))
        : [...prev, { tempId, content: body, created_at: new Date().toISOString(), failed: false }],
    )
    try {
      const saved = await sendMessage(chatId, body)
      setItems((prev) => (prev.some((x) => x.id === saved.id) ? prev : [saved, ...prev]))
      setPending((prev) => prev.filter((p) => p.tempId !== tempId))
    } catch (e) {
      setPending((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, failed: true } : p)))
      toast.error(errorMessage(e))
    }
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    void send(body)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on devices with a physical keyboard; on touch screens Enter inserts a new line.
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault()
      submit()
    }
  }

  if (peerState.loading) {
    return <div className="chat-view"><Spinner label="Opening conversation" /></div>
  }
  if (peerState.error) {
    return <ErrorState message={peerState.error} onRetry={peerState.reload} />
  }
  if (!peer) {
    return (
      <EmptyState
        icon={<MessageCircle size={28} />}
        title="Conversation not found"
        body="It may not exist, or you may not be a member of it."
        action={<Link to="/messages" className="btn btn--primary">Back to messages</Link>}
      />
    )
  }

  const name = peer.other_display_name || peer.other_username
  const ordered = [...items].reverse() // fetched newest-first, shown oldest-first
  const menu: MenuItem[] = [
    { label: 'View profile', icon: <UserRound size={18} />, onSelect: () => navigate(`/u/${peer.other_username}`) },
    { label: 'Report', icon: <Flag size={18} />, danger: true, onSelect: () => navigate(`/report/user/${peer.other_id}`) },
  ]

  let lastDay = ''
  return (
    <div className="chat-view">
      <header className="chat-header">
        <IconButton label="Back to messages" onClick={() => navigate('/messages')}><ArrowLeft size={22} /></IconButton>
        <Link to={`/u/${peer.other_username}`} className="row grow chat-header__who" aria-label={`Open ${name}'s profile`}>
          <Avatar src={peer.other_avatar_url} name={name} />
          <span style={{ minWidth: 0 }}>
            <strong className="truncate" style={{ display: 'block' }}>{name}</strong>
            <span className="small muted truncate" style={{ display: 'block' }}>@{peer.other_username}</span>
          </span>
        </Link>
        <IconButton label="Voice call" onClick={() => navigate(`/call/new?to=${peer.other_id}&type=audio`)}><Phone size={20} /></IconButton>
        <IconButton label="Video call" onClick={() => navigate(`/call/new?to=${peer.other_id}&type=video`)}><Video size={20} /></IconButton>
        <ActionMenu items={menu} label="Conversation options" />
      </header>

      {live === 'down' ? (
        <div className="glass banner banner--info" role="status"><WifiOff size={18} aria-hidden /> Reconnecting… new messages will appear when you're back online.</div>
      ) : null}

      <div className="chat-scroll" ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-label={`Conversation with ${name}`}>
        {hasMore ? (
          <div className="center">
            <Button variant="ghost" size="sm" loading={loadingMore} onClick={loadOlder}>Load earlier messages</Button>
          </div>
        ) : null}
        {loading ? <Spinner label="Loading messages" /> : null}
        {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : null}
        {!loading && !error && !ordered.length && !pending.length ? (
          <div className="empty"><p className="small">No messages yet. Say hello to {name}.</p></div>
        ) : null}

        {ordered.map((m) => {
          const mine = m.sender_id === me.id
          const label = dayLabel(m.created_at)
          const showDay = label !== lastDay
          lastDay = label
          return (
            <div key={m.id} className="chat-item">
              {showDay ? <div className="chat-day">{label}</div> : null}
              <div className={`bubble-row ${mine ? 'bubble-row--me' : ''}`}>
                {mine ? (
                  <ActionMenu
                    label="Message options"
                    items={[{ label: 'Delete message', icon: <Trash2 size={18} />, danger: true, onSelect: () => setToDelete(m) }]}
                  />
                ) : null}
                <div className={`bubble ${mine ? 'bubble--me' : 'bubble--them'}`}>
                  <RichText text={m.content} jumbo />
                  <div className="bubble__time">{clockTime(m.created_at)}</div>
                </div>
              </div>
            </div>
          )
        })}

        {pending.map((p) => (
          <div key={p.tempId} className="chat-item">
            <div className="bubble-row bubble-row--me">
              <div className={`bubble bubble--me ${p.failed ? 'bubble--failed' : 'bubble--pending'}`}>
                <RichText text={p.content} jumbo />
                <div className="bubble__time">
                  {p.failed ? (
                    <>
                      <AlertCircle size={12} aria-hidden style={{ verticalAlign: '-2px' }} /> Not sent ·{' '}
                      <button type="button" className="link-btn" onClick={() => void send(p.content, p.tempId)}>Retry</button>
                      {' · '}
                      <button type="button" className="link-btn" onClick={() => setPending((prev) => prev.filter((x) => x.tempId !== p.tempId))}>Discard</button>
                    </>
                  ) : (
                    'Sending…'
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form className="glass composer" onSubmit={submit}>
        <EmojiButton
          label="Add emoji"
          small={false}
          onPick={(emoji) => {
            const r = insertAtCaret(area.current, text, emoji, MAX_MESSAGE_LENGTH)
            setText(r.value)
            restoreCaret(area.current, r.caret)
          }}
        />
        <textarea
          ref={area}
          rows={1}
          aria-label={`Message ${name}`}
          placeholder="Message"
          maxLength={MAX_MESSAGE_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <IconButton label="Send message" type="submit" disabled={!text.trim()} active={!!text.trim()}>
          <Send size={22} />
        </IconButton>
      </form>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this message?"
        message="It will be removed for you and for them. This can't be undone."
        confirmLabel="Delete"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          await deleteMessage(toDelete.id)
          const id = toDelete.id
          setItems((prev) => prev.filter((x) => x.id !== id))
        }}
      />
    </div>
  )
}
