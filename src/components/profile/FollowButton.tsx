import { useRef } from 'react'
import { UserCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useMe } from '@/app/AuthProvider'
import { useToast } from '@/components/ui/Toast'
import { followUser, unfollowUser } from '@/services/follows'
import { errorMessage } from '@/lib/supabase'

interface FollowButtonProps {
  targetId: string
  following: boolean
  /** Called immediately (optimistic) and again with the previous value if the server rejects the change. */
  onChange: (following: boolean) => void
  size?: 'md' | 'sm'
}

/** Follow / unfollow with instant feedback and rollback. Renders nothing for your own profile. */
export function FollowButton({ targetId, following, onChange, size = 'sm' }: FollowButtonProps) {
  const me = useMe()
  const toast = useToast()
  const busy = useRef(false)
  if (targetId === me.id) return null

  const toggle = async () => {
    if (busy.current) return
    busy.current = true
    const next = !following
    onChange(next)
    try {
      if (next) await followUser(targetId)
      else await unfollowUser(me.id, targetId)
    } catch (e) {
      onChange(!next)
      toast.error(errorMessage(e))
    } finally {
      busy.current = false
    }
  }

  return (
    <Button
      variant={following ? 'glass' : 'primary'}
      size={size}
      aria-pressed={following}
      icon={following ? <UserCheck size={16} /> : <UserPlus size={16} />}
      onClick={() => void toggle()}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  )
}
