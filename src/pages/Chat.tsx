import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Archive, ArrowLeft, Flag, MessageCircle, Phone, PhoneMissed, Send, UserRound, Video, WifiOff, X } from 'lucide-react'
import type { Message, MessageReaction } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { useBadges } from '@/app/BadgesProvider'
import { ForwardDialog } from '@/components/chat/ForwardDialog'
import { MessageSheet } from '@/components/chat/MessageSheet'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { PresenceAvatar } from '@/components/ui/PresenceAvatar'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RichText } from '@/components/ui/Emoji'
import { EmojiButton } from '@/components/ui/EmojiButton'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { usePaged, useAsync } from '@/hooks/common'
import { usePresence } from '@/hooks/presence'
import { useTyping } from '@/hooks/useTyping'
import { chatLookStyle } from '@/lib/chatLook'
import { getChatPrivacy, getChatSeen, setArchived } from '@/services/chatPrefs'
import { describePresence } from '@/lib/presence'
import { insertAtCaret, restoreCaret, useAutosize } from '@/hooks/ui'
import { clockTime } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import {
  deleteMessage,
  EDIT_WINDOW_MS,
  editMessage,
  fetchMessages,
  fetchReactions,
  reactToMessage,
  subscribeReactions,
  acceptMessageRequest,
  listMessageRequestIds,
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
  const peerIds = peer ? [peer.other_id] : []
  const presenceMap = usePresence(peerIds)
  const presence = peer ? describePresence(presenceMap.get(peer.other_id)) : null

  const fetchPage = useCallback((cursor: string | null) => fetchMessages(chatId, cursor), [chatId])
  const { items, loading, loadingMore, error, hasMore, loadMore, reload, setItems } = usePaged<Message>(fetchPage, !!peer)

  const [pending, setPending] = useState<Pending[]>([])
  const [text, setText] = useState('')
  const [live, setLive] = useState<Live>('connecting')
  const [toDelete, setToDelete] = useState<Message | null>(null)
  const [sheet, setSheet] = useState<Message | null>(null)
  const [forwarding, setForwarding] = useState<string | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [reactions, setReactions] = useState<MessageReaction[]>([])
  const [isRequest, setIsRequest] = useState(false)
  useEffect(() => {
    let on = true
    void listMessageRequestIds().then((ids) => on && setIsRequest(ids.includes(chatId)))
    return () => { on = false }
  }, [chatId])
  const [, setNow] = useState(0)
  const [typingOn, setTypingOn] = useState(false)
  const [seenAt, setSeenAt] = useState<string | null>(null)
  const { peerTyping, ping } = useTyping(chatId, me.id, typingOn)
  useEffect(() => {
    void getChatPrivacy(me.id).then((p) => setTypingOn(p ? p.typing_status : false))
  }, [me.id])
  // "Seen": ask now, after each new message, and every 10 seconds while the chat is open.
  const seenKey = items[0]?.id ?? ''
  useEffect(() => {
    if (!peer) return
    let live = true
    const load = () => void getChatSeen(chatId).then((v) => live && setSeenAt(v))
    load()
    const t = window.setInterval(load, 10000)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [chatId, peer, seenKey])

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
      {
        onUpdate: (m) => setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x))),
        onDelete: (id) => setItems((prev) => prev.filter((x) => x.id !== id)),
      },
    )
    const onOnline = () => handlers.current.reload()
    window.addEventListener('online', onOnline)
    return () => {
      off()
      window.removeEventListener('online', onOnline)
    }
  }, [chatId, meId, peer, setItems])

  // Reactions for the messages on screen, kept live.
  const idsKey = items.map((m) => m.id).join(',')
  useEffect(() => {
    if (!peer || !idsKey) return
    let cancelled = false
    void fetchReactions(idsKey.split(',')).then((rows) => {
      if (cancelled) return
      setReactions((prev) => {
        const ids = new Set(idsKey.split(','))
        return [...prev.filter((r) => !ids.has(r.message_id)), ...rows]
      })
    })
    return () => {
      cancelled = true
    }
  }, [idsKey, peer])
  useEffect(() => {
    if (!peer) return
    return subscribeReactions(
      (r) => setReactions((prev) => [...prev.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id)), r]),
      (mid, uid) => setReactions((prev) => prev.filter((x) => !(x.message_id === mid && x.user_id === uid))),
    )
  }, [peer])

  // Re-evaluate the 2-minute edit window while the sheet is open.
  useEffect(() => {
    if (!sheet) return
    const t = window.setInterval(() => setNow((n) => n + 1), 5000)
    return () => window.clearInterval(t)
  }, [sheet])

  const react = async (m: Message, emoji: string | null) => {
    const before = reactions
    setReactions((prev) => [
      ...prev.filter((x) => !(x.message_id === m.id && x.user_id === meId)),
      ...(emoji ? [{ message_id: m.id, user_id: meId, emoji }] : []),
    ])
    try {
      await reactToMessage(m.id, emoji)
    } catch (e) {
      setReactions(before)
      toast.error(errorMessage(e))
    }
  }

  const startEdit = (m: Message) => {
    setEditing(m)
    setText(m.content)
    window.setTimeout(() => area.current?.focus(), 50)
  }
  const cancelEdit = () => {
    setEditing(null)
    setText('')
  }

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
    if (editing) {
      const target = editing
      if (body === target.content) return cancelEdit()
      setEditing(null)
      setText('')
      editMessage(target.id, body)
        .then(() => setItems((prev) => prev.map((x) => (x.id === target.id ? { ...x, content: body, edited_at: new Date().toISOString() } : x))))
        .catch((err) => toast.error(errorMessage(err)))
      return
    }
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
    {
      label: 'Archive chat',
      icon: <Archive size={18} />,
      onSelect: () => {
        setArchived(chatId, true).then(() => { toast.show('Chat archived'); navigate('/messages') }, (e) => toast.error(errorMessage(e)))
      },
    },
    { label: 'Report', icon: <Flag size={18} />, danger: true, onSelect: () => navigate(`/report/user/${peer.other_id}`) },
  ]

  let lastDay = ''
  const lastMineId = [...ordered].reverse().find((x) => x.sender_id === me.id && x.kind !== 'call')?.id
  return (
    <div className="chat-view" style={chatLookStyle() as React.CSSProperties}>
      <header className="chat-header">
        <IconButton label="Back to messages" onClick={() => navigate('/messages')}><ArrowLeft size={22} /></IconButton>
        <Link to={`/u/${peer.other_username}`} className="row grow chat-header__who" aria-label={`Open ${name}'s profile`}>
          <PresenceAvatar online={!!presence?.online} src={peer.other_avatar_url} name={name} />
          <span style={{ minWidth: 0 }}>
            <strong className="truncate" style={{ display: 'block' }}>{name}</strong>
            <span className={`small truncate presence-line ${peerTyping || presence?.online ? 'presence-line--online' : 'muted'}`} style={{ display: 'flex' }}>
              {peerTyping ? 'typing…' : presence ? presence.label : `@${peer.other_username}`}
            </span>
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
          if (m.kind === 'call') {
            const missed = /^(Missed|Cancelled)|declined$/.test(m.content)
            return (
              <div key={m.id} className="chat-item">
                {showDay ? <div className="chat-day">{label}</div> : null}
                <div className={`chat-call ${missed ? 'chat-call--missed' : ''}`}>
                  {missed ? <PhoneMissed size={14} aria-hidden /> : /video/i.test(m.content) ? <Video size={14} aria-hidden /> : <Phone size={14} aria-hidden />}
                  <span>{m.content}</span>
                  <span className="faint">{clockTime(m.created_at)}</span>
                </div>
              </div>
            )
          }
          const grouped = new Map<string, { n: number; mine: boolean }>()
          for (const r of reactions) {
            if (r.message_id !== m.id) continue
            const g = grouped.get(r.emoji) ?? { n: 0, mine: false }
            g.n += 1
            if (r.user_id === meId) g.mine = true
            grouped.set(r.emoji, g)
          }
          return (
            <div key={m.id} className="chat-item">
              {showDay ? <div className="chat-day">{label}</div> : null}
              <div className={`bubble-row ${mine ? 'bubble-row--me' : ''}`}>
                <div
                  className={`bubble bubble--tap ${mine ? 'bubble--me' : 'bubble--them'}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Message options"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a')) return
                    setSheet(m)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSheet(m)
                  }}
                >
                  {m.forwarded ? <div className="bubble__fwd">Forwarded</div> : null}
                  <RichText text={m.content} jumbo />
                  <div className="bubble__time">{m.edited_at ? 'edited · ' : ''}{clockTime(m.created_at)}</div>
                </div>
              </div>
              {mine && seenAt && m.id === lastMineId && new Date(seenAt).getTime() >= new Date(m.created_at).getTime() ? (
                <div className="seen-line">Seen</div>
              ) : null}
              {grouped.size ? (
                <div className={`reactions ${mine ? 'reactions--me' : ''}`}>
                  {[...grouped.entries()].map(([emoji, g]) => (
                    <button
                      key={emoji}
                      type="button"
                      className="reaction-chip"
                      aria-pressed={g.mine}
                      aria-label={`${emoji} ${g.n}`}
                      onClick={() => void react(m, g.mine ? null : emoji)}
                    >
                      {emoji}{g.n > 1 ? <span>{g.n}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
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

      {editing ? (
        <div className="glass banner banner--info" role="status">
          <span className="grow truncate">Editing message</span>
          <IconButton label="Cancel editing" small onClick={cancelEdit}><X size={18} /></IconButton>
        </div>
      ) : null}
      {isRequest ? (
        <div className="glass col" style={{ padding: 12 }}>
          <p className="small muted">{name} is not your friend yet. Accept to reply, or decline to move this chat out of your inbox.</p>
          <div className="row" style={{ gap: 8 }}>
            <Button variant="primary" onClick={() => void acceptMessageRequest(chatId).then(() => { setIsRequest(false); toast.show('Request accepted') })}>Accept</Button>
            <Button variant="glass" onClick={() => void setArchived(chatId, true).then(() => navigate('/messages', { replace: true })).catch((e) => toast.error(errorMessage(e)))}>Decline</Button>
          </div>
        </div>
      ) : (
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
          onChange={(e) => {
            setText(e.target.value)
            if (e.target.value) ping()
          }}
          onKeyDown={onKeyDown}
        />
        <IconButton label="Send message" type="submit" disabled={!text.trim()} active={!!text.trim()}>
          <Send size={22} />
        </IconButton>
      </form>
      )}

      <MessageSheet
        message={sheet}
        mine={sheet?.sender_id === meId}
        canChange={!!sheet && Date.now() - new Date(sheet.created_at).getTime() < EDIT_WINDOW_MS}
        myReaction={sheet ? (reactions.find((r) => r.message_id === sheet.id && r.user_id === meId)?.emoji ?? null) : null}
        onClose={() => setSheet(null)}
        onReact={(emoji) => sheet && void react(sheet, emoji)}
        onCopy={() => {
          if (!sheet) return
          void navigator.clipboard?.writeText(sheet.content).then(() => toast.show('Copied'), () => toast.error('Could not copy'))
        }}
        onForward={() => sheet && setForwarding(sheet.content)}
        onEdit={() => sheet && startEdit(sheet)}
        onUnsend={() => sheet && setToDelete(sheet)}
      />
      <ForwardDialog content={forwarding} onClose={() => setForwarding(null)} />

      <ConfirmDialog
        open={toDelete !== null}
        title="Unsend this message?"
        message="It will be removed for you and for them. This can't be undone."
        confirmLabel="Unsend"
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
