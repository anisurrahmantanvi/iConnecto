import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/app/AuthProvider'
import { deactivateAccount } from '@/services/deactivation'

export default function DeactivatePage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <>
      <PageHeader title="Account Deactivation" back />
      <div className="stack">
        <GlassPanel padded>
          <div className="stack">
            <p>Deactivating hides your profile from other people. Nothing is deleted.</p>
            <ul className="muted">
              <li>Your profile cannot be opened or searched by others.</li>
              <li>Your posts, comments and messages are kept.</li>
              <li>Sign in again at any time and tap Reactivate to come back.</li>
            </ul>
            <p className="small muted">Your old posts may still appear without your name until you reactivate. To remove everything for good, use Delete account in Account Center.</p>
            <Button variant="danger" onClick={() => setOpen(true)}>Deactivate my account</Button>
          </div>
        </GlassPanel>
      </div>
      <ConfirmDialog
        open={open}
        title="Deactivate your account?"
        message="You will be signed out. Sign in again to reactivate."
        confirmLabel="Deactivate"
        danger
        onClose={() => setOpen(false)}
        onConfirm={async () => { await deactivateAccount(); await signOut(); navigate('/login', { replace: true }) }}
      />
    </>
  )
}
