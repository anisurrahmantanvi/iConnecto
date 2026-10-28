import { Link } from 'react-router-dom'
import { MessageCircle, Pencil } from 'lucide-react'
import type { Profile } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { RichText } from '@/components/ui/Emoji'
import { compactNumber } from '@/lib/format'
import { FollowButton } from './FollowButton'

interface ProfileHeaderProps {
  profile: Profile
  isMe: boolean
  following: boolean
  onFollowingChange: (on: boolean) => void
  onMessage: () => void
  messaging: boolean
  menu: MenuItem[]
}

export function ProfileHeader({ profile, isMe, following, onFollowingChange, onMessage, messaging, menu }: ProfileHeaderProps) {
  const base = `/u/${profile.username}`
  return (
    <section className="glass profile-head" aria-label="Profile">
      <Avatar src={profile.avatar_url} name={profile.display_name ?? profile.username} size="xl" />
      <div>
        <h1>{profile.display_name || profile.username}</h1>
        <div className="muted">@{profile.username}</div>
      </div>
      {profile.bio ? <p className="profile-bio"><RichText text={profile.bio} /></p> : null}

      <div className="stats">
        <div><strong>{compactNumber(profile.posts_count)}</strong><span>Posts</span></div>
        <Link to={`${base}/followers`}><strong>{compactNumber(profile.followers_count)}</strong><span>Followers</span></Link>
        <Link to={`${base}/following`}><strong>{compactNumber(profile.following_count)}</strong><span>Following</span></Link>
      </div>

      <div className="row profile-actions">
        {isMe ? (
          <Link to="/settings/profile" className="btn btn--glass"><Pencil size={16} aria-hidden /> Edit profile</Link>
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
