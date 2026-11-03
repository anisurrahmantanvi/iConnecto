import { memo, useCallback, useRef, useState } from 'react'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { Link, useNavigate } from 'react-router-dom'
import { CornerDownRight, Flag, Heart, Pencil, SendHorizontal, Trash2 } from 'lucide-react'
import type { CommentView, PostView } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RichText } from '@/components/ui/Emoji'
import { EmojiButton } from '@/components/ui/EmojiButton'
import { EmptyState, ErrorState, ListSkeleton, Spinner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useInfiniteSentinel, usePaged } from '@/hooks/common'
import { insertAtCaret, restoreCaret, useAutosize } from '@/hooks/ui'
import {
  addComment,
  editComment,
  fetchComments,
  fetchReplies,
  MAX_COMMENT_LENGTH,
  removeComment,
  setCommentLike,
} from '@/services/comments'
import { compactNumber, timeAgo } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'

interface Props {
  post: PostView
  /** Reports +1 / -1 so the post card above can keep its comment counter in sync. */
  onCountChange: (delta: number) => void
}

interface ReplyTarget {
  rootId: string
  username: string
}

export function CommentSection({ post, onCountChange }: Props) {
  const me = useMe()
  const toast = useToast()
  const fetchPage = useCallback((cursor: string | null) => fetchComments(me.id, post.id, cursor), [me.id, post.id])
  const { items, loading, loadingMore, error, hasMore, loadMore, reload, setItems } = usePaged<CommentView>(fetchPage)
  const sentinel = useInfiniteSentinel(loadMore, hasMore && !loadingMore && !error)

  const [replies, setReplies] = useState<Record<string, CommentView[]>>({})
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)

  const loadReplies = useCallback(
    async (rootId: string) => {
      setLoadingReplies((s) => new Set(s).add(rootId))
      try {
        const list = await fetchReplies(me.id, rootId)
        setReplies((r) => ({ ...r, [rootId]: list }))
      } catch (e) {
        toast.error(errorMessage(e))
      } finally {
        setLoadingReplies((s) => {
          const n = new Set(s)
          n.delete(rootId)
          return n
        })
      }
    },
    [me.id, toast],
  )

  const submit = async (text: string) => {
    const created = await addComment(me.id, { postId: post.id, content: text, parentId: replyTo?.rootId ?? null })
    // The server derives author and counters; the returned row is what the database stored.
    if (replyTo) {
      const rootId = replyTo.rootId
      setItems((prev) => prev.map((c) => (c.id === rootId ? { ...c, reply_count: c.reply_count + 1 } : c)))
      setReplies((r) => ({ ...r, [rootId]: [...(r[rootId] ?? []), created] }))
      if (!replies[rootId]) void loadReplies(rootId)
    } else {
      setItems((prev) => [...prev, created])
    }
    onCountChange(1)
    setReplyTo(null)
  }

  const updateOne = (next: CommentView) => {
    if (next.parent_id) setReplies((r) => ({ ...r, [next.parent_id as string]: (r[next.parent_id as string] ?? []).map((c) => (c.id === next.id ? next : c)) }))
    else setItems((prev) => prev.map((c) => (c.id === next.id ? next : c)))
  }

  const removeOne = (c: CommentView) => {
    if (c.parent_id) {
      const pid = c.parent_id
      setReplies((r) => ({ ...r, [pid]: (r[pid] ?? []).filter((x) => x.id !== c.id) }))
      setItems((prev) => prev.map((x) => (x.id === pid ? { ...x, reply_count: Math.max(0, x.reply_count - 1) } : x)))
      onCountChange(-1)
    } else {
      setItems((prev) => prev.filter((x) => x.id !== c.id))
      setReplies((r) => {
        const { [c.id]: _gone, ...rest } = r
        return rest
      })
      onCountChange(-(1 + c.reply_count))
    }
  }

  return (
    <section id="comments" className="col" aria-label="Comments">
      <h2>Comments{post.comment_count > 0 ? ` · ${compactNumber(post.comment_count)}` : ''}</h2>
      {loading ? <ListSkeleton rows={3} /> : null}
      {!loading && error && !items.length ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && !items.length ? (
        <EmptyState title="No comments yet" body="Be the first to say something." />
      ) : null}

      <div className="comments-list" hidden={!items.length}>
        {items.map((c) => (
          <div key={c.id} className="comment-thread">
            <CommentRow
              comment={c}
              postAuthorId={post.author_id}
              onReply={() => setReplyTo({ rootId: c.id, username: c.author?.username ?? '' })}
              onUpdate={updateOne}
              onRemove={removeOne}
            />
            {c.reply_count > 0 && !replies[c.id] ? (
              <div className="comment__replies">
                <button type="button" className="link-btn comment__viewReplies" disabled={loadingReplies.has(c.id)} onClick={() => void loadReplies(c.id)}>
                  <CornerDownRight size={14} aria-hidden /> {loadingReplies.has(c.id) ? 'Loading…' : `View ${c.reply_count} ${c.reply_count === 1 ? 'reply' : 'replies'}`}
                </button>
              </div>
            ) : null}
            {(replies[c.id] ?? []).map((r) => (
              <div key={r.id} className="comment__replies">
                <CommentRow
                  comment={r}
                  postAuthorId={post.author_id}
                  isReply
                  onReply={() => setReplyTo({ rootId: c.id, username: r.author?.username ?? '' })}
                  onUpdate={updateOne}
                  onRemove={removeOne}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {loadingMore ? <Spinner label="Loading more comments" /> : null}
      {error && items.length ? <ErrorState message={error} onRetry={loadMore} /> : null}
      {hasMore && !loadingMore && !error ? (
        <div ref={sentinel} className="center">
          <Button variant="ghost" size="sm" onClick={loadMore}>View more comments</Button>
        </div>
      ) : null}

      <CommentComposer
        key={replyTo ? `${replyTo.rootId}:${replyTo.username}` : 'top'}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSubmit={submit}
      />
    </section>
  )
}

function CommentComposer({ replyTo, onCancelReply, onSubmit }: { replyTo: ReplyTarget | null; onCancelReply: () => void; onSubmit: (text: string) => Promise<void> }) {
  const me = useMe()
  const toast = useToast()
  const [text, setText] = useState(replyTo?.username ? `@${replyTo.username} ` : '')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutosize(ref, text)

  const send = async () => {
    if (busy || !text.trim()) return
    setBusy(true)
    try {
      await onSubmit(text)
      setText('')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="composer--comment">
      {replyTo ? (
        <div className="row small muted" style={{ padding: '0 4px 6px' }}>
          <CornerDownRight size={14} aria-hidden /> Replying to @{replyTo.username}
          <button type="button" className="link-btn" onClick={onCancelReply}>Cancel</button>
        </div>
      ) : null}
      <div className="comment-input">
        <Avatar src={me.avatar_url} name={me.display_name ?? me.username} size="sm" />
        <div className="comment-input__field">
          <textarea
            ref={ref}
            rows={1}
            aria-label={replyTo ? 'Write a reply' : 'Write a comment'}
            placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'}
            value={text}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
            }}
          />
          <EmojiButton
            placement="top"
            align="end"
            onPick={(emoji) => {
              const r = insertAtCaret(ref.current, text, emoji, MAX_COMMENT_LENGTH)
              setText(r.value)
              restoreCaret(ref.current, r.caret)
            }}
          />
        </div>
        <IconButton label="Send comment" disabled={busy || !text.trim()} onClick={() => void send()}>
          <SendHorizontal size={22} />
        </IconButton>
      </div>
    </div>
  )
}

const CommentRow = memo(function CommentRow({
  comment,
  postAuthorId,
  isReply = false,
  onReply,
  onUpdate,
  onRemove,
}: {
  comment: CommentView
  postAuthorId: string
  isReply?: boolean
  onReply: () => void
  onUpdate: (c: CommentView) => void
  onRemove: (c: CommentView) => void
}) {
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const mine = comment.author_id === me.id
  const canDelete = mine || postAuthorId === me.id
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const pending = useRef(false)
  const editRef = useRef<HTMLTextAreaElement>(null)

  const toggleLike = async () => {
    if (pending.current) return
    pending.current = true
    const on = !comment.liked
    onUpdate({ ...comment, liked: on, like_count: Math.max(0, comment.like_count + (on ? 1 : -1)) })
    try {
      await setCommentLike(comment.id, me.id, on)
    } catch (e) {
      onUpdate(comment)
      toast.error(errorMessage(e))
    } finally {
      pending.current = false
    }
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await editComment(comment.id, draft)
      onUpdate({ ...comment, content: draft.trim(), edited_at: new Date().toISOString() })
      setEditing(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const menu: MenuItem[] = [
    { label: 'Edit', icon: <Pencil size={18} />, hidden: !mine, onSelect: () => { setDraft(comment.content); setEditing(true) } },
    { label: 'Report', icon: <Flag size={18} />, hidden: mine, onSelect: () => navigate(`/report/comment/${comment.id}`) },
    { label: 'Delete', icon: <Trash2 size={18} />, danger: true, hidden: !canDelete, onSelect: () => setConfirm(true) },
  ]

  const a = comment.author
  return (
    <div className="comment">
      <Link to={a ? `/u/${a.username}` : '#'} aria-label="Open profile">
        <Avatar src={a?.avatar_url} name={a?.display_name ?? a?.username} size={isReply ? 'sm' : 'md'} />
      </Link>
      <div className="grow">
        {editing ? (
          <div className="col" style={{ gap: 6 }}>
            <textarea
              ref={editRef}
              className="textarea"
              style={{ minHeight: 64 }}
              aria-label="Edit comment"
              value={draft}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="row">
              <EmojiButton
                onPick={(emoji) => {
                  const r = insertAtCaret(editRef.current, draft, emoji, MAX_COMMENT_LENGTH)
                  setDraft(r.value)
                  restoreCaret(editRef.current, r.caret)
                }}
              />
              <span className="spacer" />
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button variant="primary" size="sm" loading={saving} disabled={!draft.trim()} onClick={() => void saveEdit()}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="comment__bubbleRow">
            <div className="comment__bubble">
              <Link to={a ? `/u/${a.username}` : '#'} className="post__name">{a?.display_name || a?.username || 'Deleted user'}<VerifiedBadge badge={a?.badge} size={14} /></Link>
              <div className="comment__text"><RichText text={comment.content} /></div>
              {comment.like_count > 0 ? (
                <span className="comment__likes" aria-label={`${comment.like_count} likes`}><Heart size={12} fill="currentColor" /> {compactNumber(comment.like_count)}</span>
              ) : null}
            </div>
            <ActionMenu items={menu} label="Comment options" />
          </div>
        )}
        <div className="comment__actions">
          <span className="faint">{timeAgo(comment.created_at)}{comment.edited_at ? ' · edited' : ''}</span>
          <button type="button" className={`link-btn comment__like ${comment.liked ? 'is-on' : ''}`} aria-pressed={comment.liked} onClick={() => void toggleLike()}>
            {comment.liked ? 'Liked' : 'Like'}
          </button>
          <button type="button" className="link-btn" onClick={onReply}>Reply</button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete this comment?"
        message={!isReply && comment.reply_count > 0 ? 'Its replies will be deleted too.' : "This can't be undone."}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await removeComment(comment.id)
          onRemove(comment)
        }}
      />
    </div>
  )
})
