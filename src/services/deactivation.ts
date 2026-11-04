import { supabase } from '@/lib/supabase'

/** true = my account is deactivated. Never throws: before the database update nobody is deactivated. */
export async function amIDeactivated(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('deactivated_accounts').select('user_id').eq('user_id', userId).maybeSingle()
    return !error && !!data
  } catch { return false }
}
export async function deactivateAccount(): Promise<void> {
  const { error } = await supabase.rpc('deactivate_account')
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? 'This will be available after the next database update.' : error.message)
}
export async function reactivateAccount(): Promise<void> {
  const { error } = await supabase.rpc('reactivate_account')
  if (error) throw new Error(error.message)
}

/** When my account will be deleted, or null if no deletion is scheduled (or the feature is not installed yet). */
export async function myDeletionDate(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('my_account_deletion')
    return error ? null : ((data as string | null) ?? null)
  } catch { return null }
}
export async function requestAccountDeletion(): Promise<string> {
  const { data, error } = await supabase.rpc('request_account_deletion')
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? 'This will be available after the next database update.' : error.message)
  return data as string
}
export async function cancelAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc('cancel_account_deletion')
  if (error) throw new Error(error.message)
}
