import { Link } from 'react-router-dom'
import { LifeBuoy } from 'lucide-react'
import { EmptyState, ListSkeleton } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/common'
import { timeAgo } from '@/lib/format'
import { KIND_LABEL, listMyRequests, STATUS_LABEL } from '@/services/support'

export default function SupportStatusPage() {
  const { data, loading } = useAsync(() => listMyRequests(), [])
  return (
    <>
      <PageHeader title="Report Status" back />
      <div className="stack">
        {loading ? <ListSkeleton rows={3} /> : null}
        {data === null && !loading ? <GlassPanel padded><p className="small muted">This will be available after the next database update.</p></GlassPanel> : null}
        {data && !data.length ? <EmptyState icon={<LifeBuoy size={28} />} title="Nothing sent yet" body="Reports, bugs and requests you send will show up here with their status." action={<Link to="/settings/support/problem" className="btn btn--primary">Report a problem</Link>} /> : null}
        {data?.map((r) => (
          <GlassPanel key={r.id} padded>
            <div className="row"><strong className="grow">{r.subject}</strong><span className="small muted">{STATUS_LABEL[r.status]}</span></div>
            <div className="small faint">{KIND_LABEL[r.kind]} · {timeAgo(r.created_at)}</div>
            <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.message}</p>
            {r.reply ? <p className="small" style={{ marginTop: 8 }}><strong>Reply:</strong> {r.reply}</p> : null}
          </GlassPanel>
        ))}
      </div>
    </>
  )
}
