import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import type { Community } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { RichText } from '@/components/ui/Emoji'
import { compactNumber } from '@/lib/format'

export function CommunityRow({ community }: { community: Community }) {
  return (
    <Link to={`/c/${community.slug}`} className="list-row list-row--link" aria-label={`Open ${community.name}`}>
      <Avatar src={community.avatar_url} name={community.name} size="lg" />
      <div className="grow" style={{ minWidth: 0 }}>
        <strong className="truncate" style={{ display: 'block' }}>
          {community.is_private ? <Lock size={14} aria-label="Private community" style={{ marginRight: 4, verticalAlign: '-2px' }} /> : null}
          {community.name}
        </strong>
        <span className="small muted truncate" style={{ display: 'block' }}>
          {compactNumber(community.member_count)} {community.member_count === 1 ? 'member' : 'members'}
        </span>
        {community.description ? (
          <span className="small muted community-desc"><RichText text={community.description} plain /></span>
        ) : null}
      </div>
    </Link>
  )
}
