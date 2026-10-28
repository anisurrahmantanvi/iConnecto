import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag, Shield, ShieldOff, UserMinus, Users } from 'lucide-react'
import type { CommunityMember, CommunityRole } from '@/types/db'
import { UserRow } from '@/components/profile/UserList'
import { ActionMenu, type MenuItem } from '@/components/ui/ActionMenu'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, ErrorState, ListSkeleton, Spinner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useInfiniteSentinel, usePaged } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { listMembers, removeMember, setMemberRole } from '@/services/communities'

interface MemberListProps {
  communityId: string
  myId: string
  myRole: CommunityRole | null
  /** Called after a member is removed so the parent can keep its member counter in step. */
  onMemberRemoved: () => void
}

const ROLE_LABEL: Record<CommunityRole, string> = { owner: 'Owner', moderator: 'Moderator', member: 'Member' }

/**
 * Paginated member list with moderation tools. The buttons mirror what the database allows (RLS and set_member_role):
 * the owner can promote/demote and remove anyone but themselves; moderators can remove plain members only.
 * Hiding a button is only a convenience; the server enforces the same rules.
 */
export function MemberList({ communityId, myId, myRole, onMemberRemoved }: MemberListProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const fetchPage = useCallback((cursor: string | null) => listMembers(communityId, cursor), [communityId])
  const { items, loading, loadingMore, error, hasMore, loadMore, reload, setItems } = usePaged<CommunityMember>(fetchPage)
  const sentinel = useInfiniteSentinel(loadMore, hasMore && !loadingMore && !error)
  const [toRemove, setToRemove] = useState<CommunityMember | null>(null)

  const canRemove = (m: CommunityMember): boolean =>
    m.role !== 'owner' && m.user_id !== myId && (myRole === 'owner' || (myRole === 'moderator' && m.role === 'member'))

  const changeRole = async (m: CommunityMember, role: 'member' | 'moderator') => {
    try {
      await setMemberRole(communityId, m.user_id, role)
      setItems((prev) => prev.map((x) => (x.user_id === m.user_id ? { ...x, role } : x)))
      toast.show(role === 'moderator' ? 'Made a moderator' : 'Moderator role removed')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (loading) return <ListSkeleton />
  if (error && !items.length) return <ErrorState message={error} onRetry={reload} />
  if (!items.length) return <EmptyState icon={<Users size={28} />} title="No members to show" />

  return (
    <div className="col">
      <div className="glass" role="list" aria-label="Community members">
        {items.map((m) => {
          if (!m.profile) return null
          const menu: MenuItem[] = [
            {
              label: 'Make moderator',
              icon: <Shield size={18} />,
              hidden: !(myRole === 'owner' && m.role === 'member'),
              onSelect: () => void changeRole(m, 'moderator'),
            },
            {
              label: 'Remove moderator role',
              icon: <ShieldOff size={18} />,
              hidden: !(myRole === 'owner' && m.role === 'moderator'),
              onSelect: () => void changeRole(m, 'member'),
            },
            {
              label: 'Remove from community',
              icon: <UserMinus size={18} />,
              danger: true,
              hidden: !canRemove(m),
              onSelect: () => setToRemove(m),
            },
            {
              label: 'Report',
              icon: <Flag size={18} />,
              danger: true,
              hidden: m.user_id === myId,
              onSelect: () => navigate(`/report/user/${m.user_id}`),
            },
          ]
          return (
            <div role="listitem" key={m.user_id}>
              <UserRow
                profile={m.profile}
                right={
                  <>
                    {m.role !== 'member' ? <span className="chip role-chip">{ROLE_LABEL[m.role]}</span> : null}
                    <ActionMenu items={menu} label={`Options for @${m.profile.username}`} />
                  </>
                }
              />
            </div>
          )
        })}
      </div>

      {loadingMore ? <Spinner label="Loading more members" /> : null}
      {error ? <ErrorState message={error} onRetry={loadMore} /> : null}
      {hasMore && !loadingMore && !error ? (
        <div ref={sentinel} className="center"><Button variant="ghost" size="sm" onClick={loadMore}>Load more</Button></div>
      ) : null}

      <ConfirmDialog
        open={toRemove !== null}
        title="Remove this member?"
        message={`@${toRemove?.profile?.username ?? 'this member'} will be removed from the community. They can rejoin if it is public.`}
        confirmLabel="Remove"
        danger
        onClose={() => setToRemove(null)}
        onConfirm={async () => {
          if (!toRemove) return
          await removeMember(communityId, toRemove.user_id)
          setItems((prev) => prev.filter((x) => x.user_id !== toRemove.user_id))
          onMemberRemoved()
          toast.show('Member removed')
        }}
      />
    </div>
  )
}
