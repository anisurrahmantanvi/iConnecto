import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BellOff, ChevronRight, Eye, Lock, MonitorSmartphone, UserX } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { signOutOtherDevices } from '@/services/account'

export default function PrivacyPage() {
  const { updatePassword } = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [devBusy, setDevBusy] = useState(false)

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setPwError('Use a password with at least 8 characters.')
    if (password !== confirm) return setPwError('The two passwords do not match.')
    setPwBusy(true)
    setPwError(null)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirm('')
      toast.show('Password updated')
    } catch (err) {
      setPwError(errorMessage(err))
    } finally {
      setPwBusy(false)
    }
  }

  const signOutOthers = async () => {
    setDevBusy(true)
    try {
      await signOutOtherDevices()
      toast.show('Signed out of your other devices')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDevBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Privacy and security" back="/settings" />
      <div className="stack">
        <h2 className="section-title">What others can see</h2>
        <GlassPanel padded className="col">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Eye size={22} color="var(--accent)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p className="small">
              Your profile, posts, followers and following lists are visible to anyone who has an account. Posts in a private
              community are visible to its members only.
            </p>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Lock size={22} color="var(--accent)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p className="small">
              Messages can be read only by the two people in the conversation. Your likes, bookmarks and notifications are visible
              only to you. Your email address is never shown to other users.
            </p>
          </div>
          <p className="small faint">Private (approve-to-follow) accounts are not available yet.</p>
        </GlassPanel>

        <h2 className="section-title">Safety</h2>
        <GlassPanel className="settings-list">
          <Link to="/settings/blocked" className="list-row">
            <UserX size={22} aria-hidden />
            <span className="grow">
              <strong style={{ display: 'block' }}>Blocked accounts</strong>
              <span className="small muted">People you blocked can't message, call or follow you.</span>
            </span>
            <ChevronRight size={18} className="chev" aria-hidden />
          </Link>
        </GlassPanel>

        <h2 className="section-title">Password</h2>
        <GlassPanel padded>
          <form className="col" onSubmit={(e) => void changePassword(e)} noValidate>
            {pwError ? <ErrorBanner>{pwError}</ErrorBanner> : null}
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <div className="form-actions">
              <Button type="submit" variant="primary" loading={pwBusy} disabled={!password}>Change password</Button>
            </div>
          </form>
        </GlassPanel>

        <h2 className="section-title">Devices</h2>
        <GlassPanel padded className="col">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <MonitorSmartphone size={22} color="var(--accent)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p className="small">Signed in somewhere you don't recognise? End every other session and keep this one.</p>
          </div>
          <div><Button variant="glass" loading={devBusy} onClick={() => void signOutOthers()}>Sign out other devices</Button></div>
        </GlassPanel>

        <h2 className="section-title">Notifications</h2>
        <GlassPanel padded>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <BellOff size={22} color="var(--text-faint)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p className="small muted">
              Browser push notifications are not set up in this version. You will see alerts inside the app while it is open.
            </p>
          </div>
        </GlassPanel>
      </div>
    </>
  )
}
