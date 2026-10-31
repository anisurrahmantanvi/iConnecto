import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, MailCheck, MailWarning, Trash2 } from 'lucide-react'
import { useAuth, useMe } from '@/app/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { deleteMyAccount, updateEmail } from '@/services/account'
import { SETTINGS_SECTIONS } from './settingsMenu'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AccountPage() {
  const me = useMe()
  const { user, resendVerification } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const email = user?.email ?? ''
  const verified = !!user?.email_confirmed_at

  const [newEmail, setNewEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [resendBusy, setResendBusy] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const changeEmail = async (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(newEmail.trim())) return setEmailError('Enter a valid email address.')
    setEmailBusy(true)
    setEmailError(null)
    try {
      await updateEmail(newEmail)
      setNewEmail('')
      toast.show('Check your inbox to confirm the change')
    } catch (err) {
      setEmailError(errorMessage(err))
    } finally {
      setEmailBusy(false)
    }
  }

  const resend = async () => {
    if (!email) return
    setResendBusy(true)
    try {
      await resendVerification(email)
      toast.show('Verification email sent')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setResendBusy(false)
    }
  }

  const closeDelete = () => {
    if (deleteBusy) return
    setDeleteOpen(false)
    setConfirmText('')
    setDeleteError(null)
  }

  const deleteAccount = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await deleteMyAccount(me.id)
      navigate('/login', { replace: true })
    } catch (err) {
      setDeleteError(errorMessage(err))
      setDeleteBusy(false)
    }
  }

  const confirmMatches = confirmText.trim().toLowerCase() === me.username.toLowerCase()

  return (
    <>
      <PageHeader title="Account" back="/settings" />
      <div className="stack">
        <h2 className="section-title">Email</h2>
        <GlassPanel padded className="col">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            {verified ? (
              <MailCheck size={22} color="var(--success)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            ) : (
              <MailWarning size={22} color="var(--danger)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            )}
            <div className="grow">
              <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{email || 'No email on file'}</strong>
              <span className="small muted">{verified ? 'Verified' : 'Not verified yet'}</span>
            </div>
          </div>
          {!verified && email ? (
            <div><Button variant="glass" size="sm" loading={resendBusy} onClick={() => void resend()}>Resend verification email</Button></div>
          ) : null}

          <form className="col" onSubmit={(e) => void changeEmail(e)} noValidate>
            {emailError ? <ErrorBanner>{emailError}</ErrorBanner> : null}
            <TextField
              label="New email address"
              type="email"
              autoComplete="email"
              inputMode="email"
              hint="We'll send a confirmation link. Your address changes only after you open it."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <div className="form-actions">
              <Button type="submit" variant="primary" loading={emailBusy} disabled={!newEmail.trim()}>Change email</Button>
            </div>
          </form>
        </GlassPanel>

        <h2 className="section-title">Account Memorialization</h2>
        <GlassPanel className="settings-list" as="nav" aria-label="Account Memorialization">
          {(SETTINGS_SECTIONS.find((x) => x.title === 'Account Memorialization')?.items ?? []).map((it) => (
            <button key={it.title} type="button" className="list-row" onClick={() => toast.show('Coming soon')} style={{ width: '100%', textAlign: 'left' }}>
              <strong className="grow">{it.title}</strong>
              <ChevronRight size={18} className="chev" aria-hidden />
            </button>
          ))}
        </GlassPanel>

        <h2 className="section-title">Delete account</h2>
        <GlassPanel padded className="col danger-zone">
          <p className="small muted">
            Permanently deletes your account, profile, posts, comments, messages you sent and uploaded photos. Other people will
            no longer see them. This can't be undone.
          </p>
          <div><Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>Delete my account</Button></div>
        </GlassPanel>
      </div>

      <Dialog open={deleteOpen} title="Delete your account?" onClose={closeDelete}>
        <div className="col">
          <p className="muted">
            Type your username, <strong>{me.username}</strong>, to confirm. Everything you've shared will be removed for good.
          </p>
          {deleteError ? <ErrorBanner>{deleteError}</ErrorBanner> : null}
          <TextField
            label="Your username"
            value={confirmText}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={deleteBusy}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <div className="dialog-actions">
            <Button variant="ghost" onClick={closeDelete} disabled={deleteBusy}>Cancel</Button>
            <Button variant="danger" loading={deleteBusy} disabled={!confirmMatches} onClick={() => void deleteAccount()}>
              Delete forever
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
