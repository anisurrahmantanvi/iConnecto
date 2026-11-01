import { useRef } from 'react'
import { Clock, UserCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useMe } from '@/app/AuthProvider'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { cancelFriendRequest, respondFriendRequest, sendFriendRequest, unfriend, type FriendState } from '@/services/friends'

interface Props {
  targetId: string
  state: FriendState
  /** Called at once (optimistic) and again with the earlier value if the server rejects the change. */
  onChange: (state: FriendState) => void
  size?: 'md' | 'sm'
}

/** Add friend / Requested (tap to cancel) / Accept / Friends (tap to unfriend). Renders nothing for your own profile. */
export function FriendButton({ targetId, state, onChange, size = 'sm' }: Props) {
  const me = useMe()
  const toast = useToast()
  const busy = useRef(false)
  if (targetId === me.id) return null

  const run = async (optimistic: FriendState, action: () => Promise<FriendState | void>, message?: string) => {
    if (busy.current) return
    busy.current = true
    const before = state
    onChange(optimistic)
    try {
      const result = await action()
      if (result && result !== optimistic) onChange(result)
      if (message) toast.show(message)
    } catch (e) {
      onChange(before)
      toast.error(errorMessage(e))
    } finally {
      busy.current = false
    }
  }

  if (state === 'friends') {
    return (
      <Button variant="glass" size={size} icon={<UserCheck size={16} />} onClick={() => void run('none', () => unfriend(targetId))}>
        Friends
      </Button>
    )
  }
  if (state === 'requested') {
    return (
      <Button variant="glass" size={size} icon={<Clock size={16} />} onClick={() => void run('none', () => cancelFriendRequest(targetId))}>
        Requested
      </Button>
    )
  }
  if (state === 'incoming') {
    return (
      <Button variant="primary" size={size} icon={<UserCheck size={16} />} onClick={() => void run('friends', () => respondFriendRequest(targetId, true), 'You are now friends')}>
        Accept
      </Button>
    )
  }
  return (
    <Button
      variant="primary"
      size={size}
      icon={<UserPlus size={16} />}
      onClick={() => void run('requested', async () => sendFriendRequest(targetId), undefined)}
    >
      Add friend
    </Button>
  )
}
