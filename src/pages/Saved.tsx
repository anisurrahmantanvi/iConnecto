import { Link } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { PostFeed } from '@/components/feed/PostFeed'
import { PageHeader } from '@/components/ui/PageHeader'

export default function SavedPage() {
  return (
    <>
      <PageHeader title="Saved" back="/settings" />
      <PostFeed
        source={{ kind: 'saved' }}
        removeWhenUnsaved
        empty={{
          icon: <Bookmark size={28} />,
          title: 'Nothing saved yet',
          body: 'Tap the bookmark on any post to keep it here. Only you can see this list.',
          action: <Link to="/discover?tab=posts" className="btn btn--primary">Find posts</Link>,
        }}
      />
    </>
  )
}
