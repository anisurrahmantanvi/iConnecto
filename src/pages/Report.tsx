import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Flag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextAreaField } from '@/components/ui/Field'
import { EmptyState, ErrorBanner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { errorMessage } from '@/lib/supabase'
import { REPORT_REASONS, submitReport } from '@/services/moderation'
import type { ReportReason, ReportTarget } from '@/types/db'

const TARGETS: ReportTarget[] = ['user', 'post', 'comment', 'community']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_DETAILS = 1000

const TARGET_LABEL: Record<ReportTarget, string> = {
  user: 'account',
  post: 'post',
  comment: 'comment',
  community: 'community',
}

function isTarget(v: string): v is ReportTarget {
  return (TARGETS as string[]).includes(v)
}

/** Reached from the "Report" item of a profile, post, comment, chat or community menu. */
export default function ReportPage() {
  const { targetType = '', targetId = '' } = useParams()
  const navigate = useNavigate()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (!isTarget(targetType) || !UUID_RE.test(targetId)) {
    return (
      <>
        <PageHeader title="Report" back />
        <EmptyState
          icon={<Flag size={28} />}
          title="Nothing to report"
          body="This report link isn't valid."
          action={<Link to="/" className="btn btn--primary">Go home</Link>}
        />
      </>
    )
  }

  const label = TARGET_LABEL[targetType]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason) return setError('Choose the reason that fits best.')
    setBusy(true)
    setError(null)
    try {
      await submitReport({ targetType, targetId, reason, details })
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <>
        <PageHeader title="Report" />
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title="Thanks for letting us know"
          body={`Your report about this ${label} was sent. It is private; the person isn't told who reported them. You can also block them from their profile.`}
          action={<Button variant="primary" onClick={() => navigate(-1)}>Done</Button>}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={`Report ${label}`} back />
      <form className="col" onSubmit={(e) => void submit(e)} noValidate>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        <GlassPanel>
          <fieldset className="radio-list">
            <legend className="sr-only">Reason for reporting this {label}</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="radio-row">
                <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                <span>{r.label}</span>
              </label>
            ))}
          </fieldset>
        </GlassPanel>

        <GlassPanel padded className="col">
          <TextAreaField
            label="Anything else we should know? (optional)"
            value={details}
            maxLength={MAX_DETAILS}
            rows={4}
            onChange={(e) => setDetails(e.target.value)}
          />
          <span className="char-count" aria-hidden>{details.length}/{MAX_DETAILS}</span>
        </GlassPanel>

        <div className="form-actions">
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!reason}>Send report</Button>
        </div>
      </form>
    </>
  )
}
