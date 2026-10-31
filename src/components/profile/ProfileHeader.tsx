import { Link } from 'react-router-dom'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { MessageCircle, Pencil, Plus } from 'lucide-react'
import type { Profile } from '@/types/db'
import { PresenceAvatar } from '@/components/ui/PresenceAvatar'
import { Button } from '@/components/ui/Button'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { RichText } from '@/components/ui/Emoji'
import { usePresence } from '@/hooks/presence'
import { compactNumber } from '@/lib/format'
import { describePresence } from '@/lib/presence'
import { FollowButton } from './FollowButton'

interface ProfileHeaderProps {
  profile: Profile
  isMe: boolean
  following: boolean
  onFollowingChange: (on: boolean) => void
  onMessage: () => void
  messaging: boolean
  menu: MenuItem[]
  /** Own profile only: the "Add story" button. */
  onAddStory?: () => void
}

export function ProfileHeader({ profile, isMe, following, onFollowingChange, onMessage, messaging, menu, onAddStory }: ProfileHeaderProps) {
  const base = `/u/${profile.username}`
  const presenceMap = usePresence(isMe ? [] : [profile.id])
  const presence = isMe ? null : describePresence(presenceMap.get(profile.id))
  return (
    <section className="glass profile-head profile-head--cover" aria-label="Profile">
      <div className="profile-cover" aria-hidden>
        {profile.cover_url ? <img src={profile.cover_url} alt="" decoding="async" /> : null}
      </div>
      <div className="profile-top">
        <div className="profile-id">
          <h1>{profile.display_name || profile.username}<VerifiedBadge badge={profile.badge} size={20} /></h1>
          <div className="muted">@{profile.username}</div>
        </div>
        <span className="profile-ring">
          <PresenceAvatar online={!!presence?.online} src={profile.avatar_url} name={profile.display_name ?? profile.username} size="xl" />
        </span>
      </div>
      {profile.bio ? <p className="profile-bio"><RichText text={profile.bio} /></p> : null}

      <div className="stats">
        <div><strong>{compactNumber(profile.posts_count)}</strong><span>Posts</span></div>
        <Link to={`${base}/followers`}><strong>{compactNumber(profile.followers_count)}</strong><span>Followers</span></Link>
        <Link to={`${base}/following`}><strong>{compactNumber(profile.following_count)}</strong><span>Following</span></Link>
      </div>

      <div className="row profile-actions">
        {isMe ? (
          <>
            <Button variant="primary" icon={<Plus size={16} />} onClick={onAddStory}>Add story</Button>
            <Link to="/settings/profile" className="btn btn--glass"><Pencil size={16} aria-hidden /> Edit profile</Link>
          </>
        ) : (
          <>
            <FollowButton targetId={profile.id} following={following} onChange={onFollowingChange} size="md" />
            <Button variant="glass" icon={<MessageCircle size={16} />} loading={messaging} onClick={onMessage}>Message</Button>
          </>
        )}
        <ActionMenu items={menu} label="Profile options" />
      </div>
    </section>
  )
}
