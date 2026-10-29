import { memo, useCallback, useRef, useState } from 'react'
import { appUrl } from '@/lib/base'
import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, Check, Copy, Flag, Globe, Heart, Lock, MessageCircle, Pencil, Share2, Trash2, Users } from 'lucide-react'
import type { PostView, PostVisibility } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { PhotoViewer } from '@/components/ui/PhotoViewer'
import { RichText } from '@/components/ui/Emoji'
import { EmojiButton } from '@/components/ui/EmojiButton'
import { useToast } from '@/components/ui/Toast'
import { ReactionBar, applyReaction } from './ReactionBar'
import { deletePost, MAX_POST_LENGTH, recordShare, setLike, setPostVisibility, setReaction, setSaved, updatePost } from '@/services/posts'
import { compactNumber, timeAgo } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { insertAtCaret, restoreCaret } from '@/hooks/ui'

interface PostCardProps {
  post: PostView
  onChange: (post: PostView) => void
  onDeleted: (id: string) => void
  /** Community owners/moderators may remove other people's posts in their community. */
  canModerate?: boolean
  /** On the post page the comment button does not navigate. */
  detail?: boolean
}

export const PostCard = memo(function PostCard({ post, onChange, onDeleted, canModerate = false, detail = false }: PostCardProps) {
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const mine = post.author_id === me.id
  const author = post.author
  const busy = useRef(false)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.content)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [photo, setPhoto] = useState<number | null>(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)

  const toggleLike = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const on = !post.liked
    onChange({ ...post, liked: on, like_count: Math.max(0, post.like_count + (on ? 1 : -1)) })
    try {
      await setLike(post.id, me.id, on)
    } catch (e) {
      onChange(post) // roll back
      toast.error(errorMessage(e))
    } finally {
      busy.current = false
    }
  }, [post, me.id, onChange, toast])

  const toggleSave = useCallback(async () => {
    const on = !post.saved
    onChange({ ...post, saved: on })
    try {
      await setSaved(post.id, me.id, on)
      toast.show(on ? 'Saved to your bookmarks' : 'Removed from saved')
    } catch (e) {
      onChange(post)
      toast.error(errorMessage(e))
    }
  }, [post, me.id, onChange, toast])

  const toggleReaction = useCallback(
    async (emoji: string, on: boolean) => {
      onChange({ ...post, reactions: applyReaction(post.reactions, emoji, on) })
      try {
        await setReaction(post.id, me.id, emoji, on)
      } catch (e) {
        onChange(post)
        toast.error(errorMessage(e))
      }
    },
    [post, me.id, onChange, toast],
  )

  const link = appUrl(`/p/${post.id}`)

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${author?.display_name ?? 'Someone'} on iConnecto`, text: post.content.slice(0, 100), url: link })
      } else {
        await navigator.clipboard.writeText(link)
        toast.show('Link copied')
      }
      void recordShare(post.id).catch(() => undefined)
    } catch (e) {
      // The user closing the native share sheet is not an error.
      if ((e as { name?: string }).name !== 'AbortError') toast.error('Could not share this post.')
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.show('Link copied')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  const saveEdit = async () => {
    const text = draft.trim()
    if (!text && !post.media_urls.length) {
      toast.error('A post needs some text or a photo.')
      return
    }
    setSaving(true)
    try {
      await updatePost(post.id, text)
      onChange({ ...post, content: text, edited_at: new Date().toISOString() })
      setEditing(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const changeVisibility = async (visibility: PostVisibility) => {
    try {
      await setPostVisibility(post.id, visibility)
      onChange({ ...post, visibility })
      toast.show(visibility === 'public' ? 'Post is now public' : visibility === 'followers' ? 'Only your followers can see this post' : 'Only you can see this post')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const canChangePrivacy = mine && !post.community

  const menu: MenuItem[] = [
    { label: 'Edit', icon: <Pencil size={18} />, hidden: !mine, onSelect: () => { setDraft(post.content); setEditing(true) } },
    { label: 'Privacy', icon: post.visibility === 'public' ? <Globe size={18} /> : post.visibility === 'followers' ? <Users size={18} /> : <Lock size={18} />, hidden: !canChangePrivacy, onSelect: () => setPrivacyOpen(true) },
    { label: 'Copy link', icon: <Copy size={18} />, onSelect: () => void copyLink() },
    { label: 'Report', icon: <Flag size={18} />, hidden: mine, onSelect: () => navigate(`/report/post/${post.id}`) },
    { label: mine ? 'Delete' : 'Remove (moderator)', icon: <Trash2 size={18} />, danger: true, hidden: !mine && !canModerate, onSelect: () => setConfirmDelete(true) },
  ]

  return (
    <article className="glass post" aria-label={`Post by ${author?.display_name ?? author?.username ?? 'unknown'}`}>
      <div className="post__head">
        <Link to={author ? `/u/${author.username}` : '#'} aria-label="Open profile">
          <Avatar src={author?.avatar_url} name={author?.display_name ?? author?.username} />
        </Link>
        <div className="grow">
          <Link to={author ? `/u/${author.username}` : '#'} className="post__name truncate">
            {author?.display_name || author?.username || 'Deleted user'}
          </Link>
          <div className="post__sub truncate">
            @{author?.username ?? 'unknown'} · <Link to={`/p/${post.id}`} className="muted">{timeAgo(post.created_at)}</Link>
            {post.visibility === 'followers' ? <span title="Followers only"> · <Users size={12} aria-label="Followers only" style={{ verticalAlign: '-1px' }} /></span> : null}
            {post.visibility === 'only_me' ? <span title="Only me"> · <Lock size={12} aria-label="Only me" style={{ verticalAlign: '-1px' }} /></span> : null}
            {post.edited_at ? <span> · edited</span> : null}
            {post.community ? <> · <Link to={`/c/${post.community.slug}`}>{post.community.name}</Link></> : null}
          </div>
        </div>
        <ActionMenu items={menu} label="Post options" />
      </div>

      {editing ? (
        <div className="col">
          <textarea
            ref={editRef}
            className="textarea"
            aria-label="Edit post text"
            value={draft}
            maxLength={MAX_POST_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="row">
            <EmojiButton
              onPick={(emoji) => {
                const r = insertAtCaret(editRef.current, draft, emoji, MAX_POST_LENGTH)
                setDraft(r.value)
                restoreCaret(editRef.current, r.caret)
              }}
            />
            <span className="spacer" />
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={() => void saveEdit()}>Save</Button>
          </div>
        </div>
      ) : post.content ? (
        <div className="post__body"><RichText text={post.content} jumbo /></div>
      ) : null}

      {post.media_urls.length ? (
        <div className="post__media" data-count={Math.min(post.media_urls.length, 4)}>
          {post.media_urls.slice(0, 4).map((url, i) => (
            <button key={url} type="button" className="media-btn" aria-label={`Open photo ${i + 1} of ${post.media_urls.length}`} onClick={() => setPhoto(i)}>
              <img src={url} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : null}

      <ReactionBar reactions={post.reactions} onToggle={(e, on) => void toggleReaction(e, on)} />

      <div className="post__actions">
        <IconButton label={post.liked ? 'Unlike' : 'Like'} like active={post.liked} aria-pressed={post.liked} onClick={() => void toggleLike()}>
          <Heart size={22} fill={post.liked ? 'currentColor' : 'none'} />
        </IconButton>
        <span className="count" aria-label={`${post.like_count} likes`}>{compactNumber(post.like_count)}</span>
        {detail ? (
          <IconButton label="Comments" onClick={() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })}>
            <MessageCircle size={22} />
          </IconButton>
        ) : (
          <Link to={`/p/${post.id}#comments`} className="icon-btn" aria-label={`${post.comment_count} comments, open post`}>
            <MessageCircle size={22} />
          </Link>
        )}
        <span className="count" aria-label={`${post.comment_count} comments`}>{compactNumber(post.comment_count)}</span>
        <IconButton label="Share" onClick={() => void share()}><Share2 size={21} /></IconButton>
        <span className="spacer" />
        <IconButton label={post.saved ? 'Remove from saved' : 'Save'} active={post.saved} aria-pressed={post.saved} onClick={() => void toggleSave()}>
          <Bookmark size={22} fill={post.saved ? 'currentColor' : 'none'} />
        </IconButton>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={mine ? 'Delete this post?' : 'Remove this post?'}
        message="This can't be undone. Likes, comments and photos attached to it will be removed too."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deletePost(post)
          onDeleted(post.id)
          toast.show('Post deleted')
        }}
      />
      <PhotoViewer urls={post.media_urls} index={photo} onIndexChange={setPhoto} onClose={() => setPhoto(null)} />

      <Dialog open={privacyOpen} title="Who can see this post?" onClose={() => setPrivacyOpen(false)}>
        <div className="privacy-options" role="radiogroup" aria-label="Post privacy">
          {([
            ['public', <Globe key="g" size={22} />, 'Public', 'Everyone on iConnecto'],
            ['followers', <Users key="u" size={22} />, 'Followers only', 'Only people who follow you'],
            ['only_me', <Lock key="l" size={22} />, 'Only me', 'Nobody else can see it'],
          ] as const).map(([value, icon, title, body]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={post.visibility === value}
              className="privacy-option"
              onClick={() => {
                setPrivacyOpen(false)
                if (post.visibility !== value) void changeVisibility(value)
              }}
            >
              {icon}
              <span className="privacy-option__text"><strong>{title}</strong><span className="small muted">{body}</span></span>
              {post.visibility === value ? <Check size={20} className="privacy-option__check" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </Dialog>
    </article>
  )
})
