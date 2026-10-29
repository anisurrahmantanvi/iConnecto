import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, MessageCircle, Search, Sparkles, SquarePlus } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useBadges } from '@/app/BadgesProvider'
import { PostFeed } from '@/components/feed/PostFeed'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { latestFeedTime } from '@/services/posts'
import { markOnboardingDone, onboardingDismissed } from '@/pages/auth/onboardingKey'

const POLL_MS = 30_000

export default function HomePage() {
  const { profile } = useAuth()
  const badges = useBadges()
  const [refreshKey, setRefreshKey] = useState(0)
  const [hasNew, setHasNew] = useState(false)
  const newest = useRef<string | null>(null)

  // Every ~30 s (while the app is visible) check whether someone posted something newer than what is on screen.
  useEffect(() => {
    let stop = false
    const check = async () => {
      if (document.hidden) return
      try {
        const latest = await latestFeedTime()
        if (stop || !latest) return
        if (newest.current === null) newest.current = latest
        else if (latest > newest.current) setHasNew(true)
      } catch {
        /* offline or signed out: try again on the next tick */
      }
    }
    void check()
    const id = window.setInterval(() => void check(), POLL_MS)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])

  const showNew = useCallback(() => {
    newest.current = null
    setHasNew(false)
    setRefreshKey((k) => k + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const [nudgeHidden, setNudgeHidden] = useState(onboardingDismissed)

  const showNudge = !!profile && !profile.avatar_url && !profile.bio && !nudgeHidden

  return (
    <>
      <PageHeader
        title="iConnecto"
        actions={
          <div className="row">
            <Link to="/create" className="icon-btn" aria-label="Create a post"><SquarePlus size={24} /></Link>
            <Link to="/discover" className="icon-btn" aria-label="Search"><Search size={22} /></Link>
            <Link
              to="/messages"
              className="icon-btn"
              aria-label={badges.unreadMessages ? `Messages, ${badges.unreadMessages} unread` : 'Messages'}
            >
              <MessageCircle size={22} />
              {badges.unreadMessages > 0 ? <span className="badge badge--dot" aria-hidden /> : null}
            </Link>
          </div>
        }
      />

      <div className="stack">
        {showNudge ? (
          <GlassPanel padded sheen>
            <div className="row">
              <Sparkles size={22} color="var(--accent)" aria-hidden />
              <div className="grow">
                <strong>Finish setting up your profile</strong>
                <div className="small muted">Add a photo and a bio so friends can recognise you.</div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <Link to="/onboarding" className="btn btn--primary btn--sm">Set up</Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  markOnboardingDone()
                  setNudgeHidden(true)
                }}
              >
                Not now
              </Button>
            </div>
          </GlassPanel>
        ) : null}

        {hasNew ? (
          <div className="new-posts">
            <Button variant="primary" size="sm" icon={<ArrowUp size={16} />} onClick={showNew}>New posts</Button>
          </div>
        ) : null}

        <PostFeed
          source={{ kind: 'explore' }}
          refreshKey={refreshKey}
          empty={{
            icon: <Sparkles size={28} />,
            title: 'Nothing here yet',
            body: 'Be the first to share something.',
            action: <Link to="/create" className="btn btn--primary">Create a post</Link>,
          }}
        />
      </div>
    </>
  )
}
