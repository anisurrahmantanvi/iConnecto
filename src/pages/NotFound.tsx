import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" back />
      <EmptyState
        icon={<Compass size={28} />}
        title="We couldn't find that page"
        body="The link may be mistyped or the page may have moved."
        action={<Link to="/" className="btn btn--primary">Go home</Link>}
      />
    </>
  )
}
