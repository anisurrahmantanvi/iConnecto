import { supabase } from '@/lib/supabase'
import { removeImages, type Bucket } from './storage'

export async function updateEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: `${window.location.origin}/auth/callback` },
  )
  if (error) throw new Error(error.message)
}

/** Signs out every other browser/device but keeps this session. */
export async function signOutOtherDevices(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) throw new Error(error.message)
}

const BUCKETS: Bucket[] = ['avatars', 'post-media', 'community-images']

/** Best-effort removal of everything the user uploaded (storage objects are not deleted by SQL). Never throws. */
async function purgeMyFiles(userId: string): Promise<void> {
  for (const bucket of BUCKETS) {
    try {
      const listed = await supabase.storage.from(bucket).list(userId, { limit: 1000 })
      const names: string[] = ((listed?.data ?? []) as { name: string }[]).map((f) => f.name)
      if (!names.length) continue
      const base = supabase.storage.from(bucket).getPublicUrl(`${userId}/`).data.publicUrl
      await removeImages(bucket, names.map((n) => `${base}${n}`))
    } catch {
      /* orphaned files are harmless; the account deletion below is what matters */
    }
  }
}

/**
 * Permanently deletes the signed-in user's account through the `delete_my_account` database function
 * (migration 0007), which removes the auth user; foreign keys cascade to their profile and content.
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  await purgeMyFiles(userId)
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw new Error(error.message)
  try {
    await supabase.auth.signOut()
  } catch {
    /* the user no longer exists, so the server may refuse; the local session is cleared either way */
  }
}
