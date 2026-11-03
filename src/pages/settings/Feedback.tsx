import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { sendSupportRequest, type SupportKind } from '@/services/support'

const COPY: Record<SupportKind, { title: string; intro: string; subject: string; message: string }> = {
  problem: { title: 'Report a Problem', intro: 'Something not working or not right? Tell us what happened.', subject: 'What went wrong?', message: 'Describe the problem: what you did, what you expected, and what happened instead.' },
  bug: { title: 'Report a Bug', intro: 'Found a bug? The more detail, the faster we can fix it.', subject: 'Short title of the bug', message: 'Steps to reproduce, which screen, and what you saw. Mention your phone model if it matters.' },
  feature: { title: 'Request a Feature', intro: 'Tell us what would make iConnecto better for you.', subject: 'Feature name', message: 'Describe the feature and how you would use it.' },
  contact: { title: 'Contact Support', intro: 'Questions about your account or the app? Write to us here.', subject: 'Subject', message: 'How can we help?' },
}

/** One form for all four support screens. Do not include passwords or codes. */
export default function FeedbackPage({ kind }: { kind: SupportKind }) {
  const c = COPY[kind]
  const toast = useToast()
  const navigate = useNavigate()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const valid = subject.trim().length >= 3 && message.trim().length >= 10

  const send = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await sendSupportRequest(kind, subject, message)
      toast.show('Sent. Track it in Report Status.')
      navigate('/settings/support/status', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title={c.title} back />
      <div className="stack">
        <GlassPanel padded>
          <div className="stack">
            <p className="muted">{c.intro}</p>
            <TextField label={c.subject} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />
            <TextAreaField label="Details" placeholder={c.message} rows={6} value={message} maxLength={3000} onChange={(e) => setMessage(e.target.value)} hint="Never include your password or verification codes." />
            <Button variant="primary" loading={busy} disabled={!valid} onClick={() => void send()}>Send</Button>
          </div>
        </GlassPanel>
      </div>
    </>
  )
}
