import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, RefreshCw, Sparkles, Users } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useBadges } from '@/app/BadgesProvider'
import { PostFeed } from '@/components/feed/PostFeed'
import { Button, IconButton } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { useT } from '@/lib/i18n'
import { markOnboardingDone, onboardingDismissed } from '@/pages/auth/onboardingKey'

type Tab = 'following' | 'explore'

export default function HomePage() {
  const { t } = useT()
  const { profile } = useAuth()
  const badges = useBadges()
  const [tab, setTab] = useState<Tab>('following')
  const [refreshKey, setRefreshKey] = useState(0)
  const [nudgeHidden, setNudgeHidden] = useState(onboardingDismissed)

  const showNudge = !!profile && !profile.avatar_url && !profile.bio && !nudgeHidden

  return (
    <>
      <PageHeader
        title="iConnecto"
        actions={
          <div className="row">
            <IconButton label="Refresh feed" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw size={20} />
            </IconButton>
            <Link to="/communities" className="icon-btn" aria-label="Communities"><Users size={22} /></Link>
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

        <Tabs
          label="Feed"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'following', label: t('home.following') },
            { value: 'explore', label: t('home.explore') },
          ]}
        />

        {tab === 'following' ? (
          <PostFeed
            source={{ kind: 'home' }}
            refreshKey={refreshKey}
            empty={{
              icon: <Users size={28} />,
              title: 'Your feed is quiet',
              body: 'Follow people to see their posts here, or explore what everyone is sharing.',
              action: <Button variant="primary" onClick={() => setTab('explore')}>Explore posts</Button>,
            }}
          />
        ) : (
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
        )}
      </div>
    </>
  )
}
