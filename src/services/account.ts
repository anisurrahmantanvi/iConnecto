import { supabase } from '@/lib/supabase'
import { appUrl } from '@/lib/base'
import { requestAccountDeletion } from './deactivation'

export async function updateEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: appUrl('/auth/callback') },
  )
  if (error) throw new Error(error.message)
}

/** Signs out every other browser/device but keeps this session. */
export async function signOutOtherDevices(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) throw new Error(error.message)
}

/**
 * Starts the 30-day account deletion: the profile is hidden at once and the account, content and files are
 * permanently removed after the waiting period (migration 0030 + the purge-accounts function). Signing in again cancels it.
 */
export async function deleteMyAccount(): Promise<string> {
  const due = await requestAccountDeletion()
  try {
    await supabase.auth.signOut()
  } catch {
    /* the local session is cleared either way */
  }
  return due
}
