import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import type { CommunityRole, PostView } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { CommentSection } from '@/components/feed/CommentSection'
import { PostCard } from '@/components/feed/PostCard'
import { EmptyState, ErrorState, PostSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/common'
import { getMyRole } from '@/services/communities'
import { fetchPost } from '@/services/posts'

export default function PostDetailPage() {
  const { postId = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const { data: post, setData, loading, error, reload } = useAsync(() => fetchPost(me.id, postId), [me.id, postId])
  const [role, setRole] = useState<CommunityRole | null>(null)

  const communityId = post?.community_id ?? null
  useEffect(() => {
    if (!communityId) {
      setRole(null)
      return
    }
    let cancelled = false
    getMyRole(communityId, me.id)
      .then((r) => !cancelled && setRole(r))
      .catch(() => undefined) // without a role the viewer simply gets no moderation menu item
    return () => {
      cancelled = true
    }
  }, [communityId, me.id])

  const onChange = useCallback((next: PostView) => setData(next), [setData])
  const onDeleted = useCallback(() => navigate('/', { replace: true }), [navigate])
  const onCountChange = useCallback(
    (delta: number) => setData((p) => (p ? { ...p, comment_count: Math.max(0, p.comment_count + delta) } : p)),
    [setData],
  )

  return (
    <>
      <PageHeader title="Post" back />
      {loading ? (
        <PostSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !post ? (
        <EmptyState
          icon={<FileQuestion size={28} />}
          title="Post not found"
          body="It may have been deleted, or you might not have access to it."
          action={<Link to="/" className="btn btn--primary">Back to home</Link>}
        />
      ) : (
        <div className="stack">
          <PostCard post={post} onChange={onChange} onDeleted={onDeleted} canModerate={role === 'owner' || role === 'moderator'} detail />
          <CommentSection post={post} onCountChange={onCountChange} />
        </div>
      )}
    </>
  )
}
