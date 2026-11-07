import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Copy, Flag, Globe, Pencil, PenSquare } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { PostFeed } from '@/components/feed/PostFeed'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { appUrl } from '@/lib/base'
import { compactNumber } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { categoryLabel, followPage, getPageBySlug, isFollowingPage, myPageRole, unfollowPage } from '@/services/pages'
import { setActingAs, useActingAs } from '@/lib/actingAs'
import { RichText } from '@/components/ui/Emoji'


export default function PageViewPage() {
  const { slug = '' } = useParams()
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const acting = useActingAs()
  const { data: page, loading, error, reload } = useAsync(() => getPageBySlug(slug), [slug])
  const [role, setRole] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!page) return
    let off = false
    setCount(page.follower_count)
    void myPageRole(page.id, me.id).then((r) => !off && setRole(r))
    void isFollowingPage(page.id, me.id).then((f) => !off && setFollowing(f))
    return () => { off = true }
  }, [page, me.id])

  const toggle = useCallback(async () => {
    if (!page || busy) return
    setBusy(true)
    const on = !following
    try {
      if (on) await followPage(page.id)
      else await unfollowPage(page.id, me.id)
      setFollowing(on)
      setCount((c) => Math.max(0, c + (on ? 1 : -1)))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [page, busy, following, me.id, toast])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl(`/page/${slug}`))
      toast.show('Page link copied')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  if (loading) return (<><PageHeader title="Page" back /><ListSkeleton rows={2} /></>)
  if (error) return (<><PageHeader title="Page" back /><ErrorState message={error} onRetry={reload} /></>)
  if (!page) {
    return (
      <>
        <PageHeader title="Page" back />
        <EmptyState icon={<Flag size={28} />} title="Page not found" body="This page does not exist or is not available yet." action={<Link to="/pages" className="btn btn--primary">Browse pages</Link>} />
      </>
    )
  }
  const canPost = role !== null
  const admin = role === 'owner' || role === 'admin'

  return (
    <>
      <PageHeader title={page.name} back />
      <div className="stack feed-bleed">
        <section className="glass profile-head profile-head--cover" aria-label="Page">
          <div className="profile-cover" aria-hidden>{page.cover_url ? <img src={page.cover_url} alt="" decoding="async" /> : null}</div>
          <div className="profile-top">
            <div className="profile-id">
              <h1>{page.name}</h1>
              <div className="muted">{categoryLabel(page.category)} · @{page.slug}</div>
            </div>
            <span className="profile-ring"><Avatar src={page.avatar_url} name={page.name} size="xl" /></span>
          </div>
          {page.bio ? <p className="profile-bio"><RichText text={page.bio} /></p> : null}
          {page.website ? <a className="small row" href={page.website} target="_blank" rel="noopener noreferrer nofollow"><Globe size={14} aria-hidden /> {page.website.replace(/^https?:\/\//, '')}</a> : null}
          <div className="stats"><div><strong>{compactNumber(count)}</strong><span>Followers</span></div></div>
          <div className="row profile-actions">
            {canPost ? (
              <>
                {acting === page.slug
                  ? <Button variant="glass" onClick={() => setActingAs('')}>Switch to personal profile</Button>
                  : <Button variant="glass" onClick={() => setActingAs(page.slug)}>Switch to this Page</Button>}
                <Button variant="primary" icon={<PenSquare size={16} />} onClick={() => navigate(`/create?page=${page.slug}`)}>Post</Button>
                <Link to={`/page/${page.slug}/notifications`} className="btn btn--glass">Notifications</Link>
                {admin ? <Link to={`/page/${page.slug}/edit`} className="btn btn--glass"><Pencil size={16} aria-hidden /> Manage</Link> : null}
              </>
            ) : null}
            <Button variant={following ? 'glass' : 'primary'} loading={busy} onClick={() => void toggle()}>{following ? 'Following' : 'Follow'}</Button>
            <Button variant="glass" icon={<Copy size={16} />} onClick={() => void copyLink()}>Copy link</Button>
          </div>
        </section>
        <PostFeed
          source={{ kind: 'page', pageId: page.id }}
          empty={{ title: 'No posts yet', body: canPost ? 'Tap Post to share the first update.' : `${page.name} has not posted yet.` }}
        />
      </div>
    </>
  )
}
