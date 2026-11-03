import { Link } from 'react-router-dom'
import { ImagePlus } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'

/** "What's on your mind?" bar. Opens the New post screen. */
export function ComposerBar() {
  const me = useMe()
  return (
    <div className="glass row composer-bar" style={{ padding: '10px 14px', gap: 12, borderRadius: 0 }}>
      <Link to={`/u/${me.username}`} aria-label="Your profile"><Avatar src={me.avatar_url} name={me.display_name ?? me.username} /></Link>
      <Link to="/create" className="grow muted" style={{ padding: '10px 14px', borderRadius: 999, border: '1px solid var(--border, rgba(120,120,140,0.25))' }}>
        What's on your mind?
      </Link>
      <Link to="/create" className="icon-btn" aria-label="Add photo"><ImagePlus size={22} /></Link>
    </div>
  )
}
