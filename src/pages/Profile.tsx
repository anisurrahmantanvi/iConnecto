import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, Copy, Flag, Pencil, Phone, Settings, UserX, Video } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { PostFeed } from '@/components/feed/PostFeed'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import type { MenuItem } from '@/components/ui/ActionMenu'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { getOrCreateDm } from '@/services/chat'
import { isFollowing } from '@/services/follows'
import { blockUser, isBlockedByMe, unblockUser } from '@/services/moderation'
import { getProfileByUsername } from '@/services/profiles'

export default function ProfilePage() {
  const { username = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: profile, setData: setProfile, loading, error, reload } = useAsync(() => getProfileByUsername(username), [username])
  const isMe = profile?.id === me.id

  const [following, setFollowing] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)

  const profileId = profile?.id ?? null
  useEffect(() => {
    if (!profileId || profileId === me.id) {
      setFollowing(false)
      setBlocked(false)
      return
    }
    let cancelled = false
    Promise.all([isFollowing(me.id, profileId), isBlockedByMe(me.id, profileId)])
      .then(([f, b]) => {
        if (cancelled) return
        setFollowing(f)
        setBlocked(b)
      })
      .catch(() => undefined) // the buttons fall back to "Follow"; the server still rejects duplicates
    return () => {
      cancelled = true
    }
  }, [profileId, me.id])

  const onFollowingChange = useCallback(
    (on: boolean) => {
      setFollowing(on)
      setProfile((p) => (p ? { ...p, followers_count: Math.max(0, p.followers_count + (on ? 1 : -1)) } : p))
    },
    [setProfile],
  )

  const message = async () => {
    if (!profile) return
    setMessaging(true)
    try {
      navigate(`/messages/${await getOrCreateDm(profile.id)}`)
    } catch (e) {
      toast.error(errorMessage(e))
      setMessaging(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${username}`)
      toast.show('Profile link copied')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  const unblock = async () => {
    if (!profile) return
    try {
      await unblockUser(me.id, profile.id)
      setBlocked(false)
      toast.show(`Unblocked @${profile.username}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const menu: MenuItem[] = profile
    ? isMe
      ? [
          { label: 'Edit profile', icon: <Pencil size={18} />, onSelect: () => navigate('/settings/profile') },
          { label: 'Copy profile link', icon: <Copy size={18} />, onSelect: () => void copyLink() },
          { label: 'Settings', icon: <Settings size={18} />, onSelect: () => navigate('/settings') },
        ]
      : [
          { label: 'Voice call', icon: <Phone size={18} />, hidden: blocked, onSelect: () => navigate(`/call/new?to=${profile.id}&type=audio`) },
          { label: 'Video call', icon: <Video size={18} />, hidden: blocked, onSelect: () => navigate(`/call/new?to=${profile.id}&type=video`) },
          { label: 'Copy profile link', icon: <Copy size={18} />, onSelect: () => void copyLink() },
          blocked
            ? { label: 'Unblock', icon: <UserX size={18} />, onSelect: () => void unblock() }
            : { label: 'Block', icon: <Ban size={18} />, danger: true, onSelect: () => setConfirmBlock(true) },
          { label: 'Report', icon: <Flag size={18} />, danger: true, onSelect: () => navigate(`/report/user/${profile.id}`) },
        ]
    : []

  if (loading) {
    return (
      <>
        <PageHeader title={`@${username}`} back />
        <div className="glass profile-head" aria-busy="true" aria-label="Loading profile">
          <Skeleton width={96} height={96} radius="50%" />
          <Skeleton width="50%" height={20} />
          <Skeleton width="30%" />
        </div>
        <div style={{ marginTop: 16 }}><ListSkeleton rows={2} /></div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title={`@${username}`} back />
        <ErrorState message={error} onRetry={reload} />
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <PageHeader title="Profile" back />
        <EmptyState
          icon={<UserX size={28} />}
          title="User not found"
          body={`There is no account called @${username}, or it is not available to you.`}
          action={<Link to="/discover" className="btn btn--primary">Find people</Link>}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={`@${profile.username}`} back={isMe ? undefined : true} />
      <div className="stack">
        <ProfileHeader
          profile={profile}
          isMe={isMe}
          following={following}
          onFollowingChange={onFollowingChange}
          onMessage={() => void message()}
          messaging={messaging}
          menu={menu}
        />

        {blocked ? (
          <div className="glass card col" role="status">
            <strong>You blocked @{profile.username}</strong>
            <p className="small muted">You can't see each other's posts or message one another. Unblock to see their posts again.</p>
            <div><Button variant="glass" size="sm" onClick={() => void unblock()}>Unblock</Button></div>
          </div>
        ) : (
          <PostFeed
            source={{ kind: 'author', authorId: profile.id }}
            empty={
              isMe
                ? {
                    title: "You haven't posted yet",
                    body: 'Share your first photo or thought.',
                    action: <Link to="/create" className="btn btn--primary">Create a post</Link>,
                  }
                : { title: 'No posts yet', body: `@${profile.username} hasn't shared anything yet.` }
            }
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmBlock}
        title={`Block @${profile.username}?`}
        message="They won't be able to message, call or follow you, and you won't see each other's posts. They are not told that you blocked them."
        confirmLabel="Block"
        danger
        onClose={() => setConfirmBlock(false)}
        onConfirm={async () => {
          await blockUser(profile.id)
          setBlocked(true)
          setFollowing(false)
          reload()
          toast.show(`Blocked @${profile.username}`)
        }}
      />
    </>
  )
}
