import { useCallback, useEffect, useState } from 'react'
import { appUrl } from '@/lib/base'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, Copy, Flag, Lock, LogOut, Menu, Phone, Settings, UserPlus, UserX, Video } from 'lucide-react'
import { useAuth, useMe } from '@/app/AuthProvider'
import { PostFeed } from '@/components/feed/PostFeed'
import { ProfileAbout } from '@/components/profile/ProfileAbout'
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
import { countFriends, getFriendState, type FriendState } from '@/services/friends'
import { getIsPrivate } from '@/services/privateAccount'
import { blockUser, isBlockedByMe, unblockUser } from '@/services/moderation'
import { getProfileAbout, getProfileByUsername } from '@/services/profiles'

export default function ProfilePage() {
  const { username = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const { signOut } = useAuth()
  const logOut = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const { data: profile, loading, error, reload } = useAsync(() => getProfileByUsername(username), [username])
  const isMe = profile?.id === me.id
  // Optional details; if they cannot be loaded the About card still shows the joining date.
  const { data: about } = useAsync(() => (profile ? getProfileAbout(profile.id).catch(() => null) : Promise.resolve(null)), [profile?.id])

  const [friendState, setFriendState] = useState<FriendState>('none')
  const [friendsCount, setFriendsCount] = useState<number | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const profileId = profile?.id ?? null
  useEffect(() => {
    if (!profileId || profileId === me.id) {
      setFriendState('none')
      setBlocked(false)
      setIsPrivate(false)
      return
    }
    let cancelled = false
    Promise.all([getFriendState(me.id, profileId), isBlockedByMe(me.id, profileId)])
      .then(([f, b]) => {
        if (cancelled) return
        setFriendState(f)
        setBlocked(b)
      })
      .catch(() => undefined) // the button falls back to "Add friend"; the server still rejects duplicates
    return () => {
      cancelled = true
    }
  }, [profileId, me.id])

  // Private-account details load on their own, so an older database simply shows an ordinary profile.
  useEffect(() => {
    if (!profileId || profileId === me.id) return
    let cancelled = false
    void getIsPrivate(profileId).then((priv) => {
      if (!cancelled) setIsPrivate(priv === true)
    })
    return () => {
      cancelled = true
    }
  }, [profileId, me.id])

  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    void countFriends(profileId).then((n) => !cancelled && setFriendsCount(n))
    return () => {
      cancelled = true
    }
  }, [profileId, friendState])

  const onFriendStateChange = useCallback((s: FriendState) => setFriendState(s), [])

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
      await navigator.clipboard.writeText(appUrl(`/u/${username}`))
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
          { label: 'Settings & Privacy', icon: <Settings size={18} />, onSelect: () => navigate('/settings') },
          { label: 'Add Account', icon: <UserPlus size={18} />, onSelect: () => toast.show('Coming soon') },
          { label: 'Log Out', icon: <LogOut size={18} />, danger: true, onSelect: () => setConfirmLogout(true) },
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
      <PageHeader
        title={`@${profile.username}`}
        back={isMe ? undefined : true}
        actions={isMe ? <span className="page-header__actions"><Link to="/menu" className="icon-btn" aria-label="Menu"><Menu size={24} /></Link></span> : undefined}
      />
      <div className="stack feed-bleed">
        <ProfileHeader
          profile={profile}
          isMe={isMe}
          friendState={friendState}
          onFriendStateChange={onFriendStateChange}
          friendsCount={friendsCount}
          isPrivate={isPrivate}
          onMessage={() => void message()}
          messaging={messaging}
          menu={isMe ? [] : menu}
          onAddStory={isMe ? () => toast.show('Stories are coming soon') : undefined}
        />

        <ProfileAbout about={about} joinedAt={profile.created_at} />

        {blocked ? (
          <div className="glass card col" role="status">
            <strong>You blocked @{profile.username}</strong>
            <p className="small muted">You can't see each other's posts or message one another. Unblock to see their posts again.</p>
            <div><Button variant="glass" size="sm" onClick={() => void unblock()}>Unblock</Button></div>
          </div>
        ) : !isMe && isPrivate && friendState !== 'friends' ? (
          <div className="glass card col" role="status" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Lock size={28} aria-hidden />
            <strong>This account is private</strong>
            <p className="small muted">Send @{profile.username} a friend request to see their posts. They need to accept it first.</p>
          </div>
        ) : (
          <div>
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
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You will be logged out of this account on this phone. Your account and data are not deleted."
        confirmLabel="Log out"
        onConfirm={logOut}
        onClose={() => setConfirmLogout(false)}
      />
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
          setFriendState('none')
          reload()
          toast.show(`Blocked @${profile.username}`)
        }}
      />
    </>
  )
}
