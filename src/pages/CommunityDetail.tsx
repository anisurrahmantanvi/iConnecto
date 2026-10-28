import { useEffect, useState } from 'react'
import { appUrl } from '@/lib/base'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, Flag, Lock, LogOut, Pencil, Plus, UserPlus, Users } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { MemberList } from '@/components/communities/MemberList'
import { PostFeed } from '@/components/feed/PostFeed'
import type { MenuItem } from '@/components/ui/ActionMenu'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RichText } from '@/components/ui/Emoji'
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { compactNumber } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { getCommunityBySlug, getMyRole, joinCommunity, leaveCommunity } from '@/services/communities'
import type { CommunityRole } from '@/types/db'

type Tab = 'posts' | 'members'

export default function CommunityDetailPage() {
  const { slug = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: community, setData: setCommunity, loading, error, reload } = useAsync(() => getCommunityBySlug(slug), [slug])
  const [role, setRole] = useState<CommunityRole | null>(null)
  const [tab, setTab] = useState<Tab>('posts')
  const [busy, setBusy] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const communityId = community?.id ?? null
  useEffect(() => {
    if (!communityId) {
      setRole(null)
      return
    }
    let cancelled = false
    getMyRole(communityId, me.id)
      .then((r) => !cancelled && setRole(r))
      .catch(() => !cancelled && setRole(null)) // falls back to "Join"; the server still decides what is allowed
    return () => {
      cancelled = true
    }
  }, [communityId, me.id])

  const isMember = role !== null
  const isMod = role === 'owner' || role === 'moderator'

  const join = async () => {
    if (!community) return
    setBusy(true)
    try {
      await joinCommunity(community.id)
      setRole('member')
      setCommunity((c) => (c ? { ...c, member_count: c.member_count + 1 } : c))
      toast.show(`Joined ${community.name}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl(`/c/${slug}`))
      toast.show('Community link copied')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Community" back />
        <div className="glass profile-head" aria-busy="true" aria-label="Loading community">
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
        <PageHeader title="Community" back />
        <ErrorState message={error} onRetry={reload} />
      </>
    )
  }

  if (!community) {
    return (
      <>
        <PageHeader title="Community" back />
        <EmptyState
          icon={<Users size={28} />}
          title="Community not found"
          body="It may have been deleted, or it is private and only visible to its members."
          action={<Link to="/communities" className="btn btn--primary">Browse communities</Link>}
        />
      </>
    )
  }

  const menu: MenuItem[] = [
    { label: 'Edit community', icon: <Pencil size={18} />, hidden: !isMod, onSelect: () => navigate(`/c/${community.slug}/edit`) },
    { label: 'Copy link', icon: <Copy size={18} />, onSelect: () => void copyLink() },
    { label: 'Report community', icon: <Flag size={18} />, danger: true, hidden: role === 'owner', onSelect: () => navigate(`/report/community/${community.id}`) },
  ]

  return (
    <>
      <PageHeader title={community.name} back="/communities" />
      <div className="stack">
        <section className="glass profile-head" aria-label="About this community">
          <Avatar src={community.avatar_url} name={community.name} size="xl" />
          <div>
            <h1>
              {community.is_private ? <Lock size={18} aria-label="Private community" style={{ marginRight: 6, verticalAlign: '-2px' }} /> : null}
              {community.name}
            </h1>
            <div className="muted">
              {compactNumber(community.member_count)} {community.member_count === 1 ? 'member' : 'members'}
              {role ? ` · You are ${role === 'owner' ? 'the owner' : role === 'moderator' ? 'a moderator' : 'a member'}` : ''}
            </div>
          </div>
          {community.description ? <p className="profile-bio"><RichText text={community.description} /></p> : null}

          <div className="row profile-actions">
            {isMember ? (
              <>
                <Link to={`/create?community=${community.id}`} className="btn btn--primary"><Plus size={16} aria-hidden /> Post</Link>
                {role !== 'owner' ? (
                  <Button variant="glass" icon={<LogOut size={16} />} onClick={() => setConfirmLeave(true)}>Leave</Button>
                ) : null}
              </>
            ) : (
              <Button variant="primary" icon={<UserPlus size={16} />} loading={busy} onClick={() => void join()}>Join</Button>
            )}
            <ActionMenu items={menu} label="Community options" />
          </div>
          {role === 'owner' ? (
            <p className="small faint">Owners can't leave. To close the community, open Edit community and delete it.</p>
          ) : null}
        </section>

        <Tabs
          label="Community sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'posts', label: 'Posts' },
            { value: 'members', label: 'Members' },
          ]}
        />

        {tab === 'posts' ? (
          <PostFeed
            source={{ kind: 'community', communityId: community.id }}
            canModerate={isMod}
            empty={{
              icon: <Check size={28} />,
              title: 'No posts yet',
              body: isMember ? 'Be the first to post in this community.' : 'Join to start posting.',
              action: isMember ? <Link to={`/create?community=${community.id}`} className="btn btn--primary">Create a post</Link> : undefined,
            }}
          />
        ) : (
          <MemberList
            communityId={community.id}
            myId={me.id}
            myRole={role}
            onMemberRemoved={() => setCommunity((c) => (c ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c))}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title={`Leave ${community.name}?`}
        message={
          community.is_private
            ? 'This community is private. After you leave you will no longer see it, and you cannot rejoin without being added again.'
            : 'You can rejoin at any time.'
        }
        confirmLabel="Leave"
        danger
        onClose={() => setConfirmLeave(false)}
        onConfirm={async () => {
          await leaveCommunity(community.id, me.id)
          setRole(null)
          setCommunity((c) => (c ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c))
          toast.show(`Left ${community.name}`)
          if (community.is_private) navigate('/communities', { replace: true })
        }}
      />
    </>
  )
}
