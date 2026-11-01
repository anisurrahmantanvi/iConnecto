import { useRef } from 'react'
import { UserCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useMe } from '@/app/AuthProvider'
import { useToast } from '@/components/ui/Toast'
import { unfollowUser } from '@/services/follows'
import { cancelFollowRequest, requestFollow } from '@/services/privateAccount'
import { errorMessage } from '@/lib/supabase'

interface FollowButtonProps {
  targetId: string
  following: boolean
  /** Called immediately (optimistic) and again with the previous value if the server rejects the change. */
  onChange: (following: boolean) => void
  size?: 'md' | 'sm'
  /** A follow request to this (private) account is waiting for approval. */
  requested?: boolean
  onRequestedChange?: (requested: boolean) => void
}

/** Follow / unfollow with instant feedback and rollback. Renders nothing for your own profile. */
export function FollowButton({ targetId, following, onChange, size = 'sm', requested = false, onRequestedChange }: FollowButtonProps) {
  const me = useMe()
  const toast = useToast()
  const busy = useRef(false)
  if (targetId === me.id) return null

  const toggle = async () => {
    if (busy.current) return
    busy.current = true
    try {
      if (following) {
        onChange(false)
        try {
          await unfollowUser(me.id, targetId)
        } catch (e) {
          onChange(true)
          throw e
        }
      } else if (requested) {
        onRequestedChange?.(false)
        try {
          await cancelFollowRequest(targetId)
        } catch (e) {
          onRequestedChange?.(true)
          throw e
        }
      } else {
        onChange(true) // shown at once; undone below if the account is private
        try {
          const result = await requestFollow(targetId)
          if (result === 'requested') {
            onChange(false)
            onRequestedChange?.(true)
            toast.show('Follow request sent')
          }
        } catch (e) {
          onChange(false)
          throw e
        }
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      busy.current = false
    }
  }

  return (
    <Button
      variant={following || requested ? 'glass' : 'primary'}
      size={size}
      aria-pressed={following || requested}
      icon={following ? <UserCheck size={16} /> : <UserPlus size={16} />}
      onClick={() => void toggle()}
    >
      {following ? 'Following' : requested ? 'Requested' : 'Follow'}
    </Button>
  )
}
