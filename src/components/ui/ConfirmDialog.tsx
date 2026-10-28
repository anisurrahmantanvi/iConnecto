import { useState } from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { errorMessage } from '@/lib/supabase'
import { ErrorBanner } from './Feedback'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

/** Asks before a destructive action. Shows the error inline if the action fails and stays open. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title={title} onClose={busy ? () => undefined : onClose}>
      <div className="col">
        <p className="muted">{message}</p>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        <div className="dialog-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={() => void run()}>{confirmLabel}</Button>
        </div>
      </div>
    </Dialog>
  )
}
