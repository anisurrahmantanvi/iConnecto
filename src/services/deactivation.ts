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
