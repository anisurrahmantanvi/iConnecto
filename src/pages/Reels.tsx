import { Link } from 'react-router-dom'
import { Clapperboard } from 'lucide-react'
import { EmptyState } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'

/** Placeholder: short-video posts are not built yet, so this says so instead of pretending. */
export default function ReelsPage() {
  return (
    <>
      <PageHeader title="Reels" />
      <EmptyState
        icon={<Clapperboard size={28} />}
        title="Reels are coming soon"
        body="Short videos are not available in iConnecto yet. For now you can share photos and text in posts."
        action={<Link to="/create" className="btn btn--primary">Create a post</Link>}
      />
    </>
  )
}
