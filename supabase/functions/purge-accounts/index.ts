// Permanently deletes accounts whose 30-day waiting period has ended (see migration 0030).
// Runs daily from .github/workflows/purge-accounts.yml. Deploy with --no-verify-jwt.
// It needs no secret from the caller: it only ever does what the account owners already asked for, and only once their date has passed.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every function; they never reach the app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const BUCKETS = ['avatars', 'covers', 'post-media', 'post-audio', 'community-images', 'market-media']

async function removeFolder(bucket: string, folder: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000 })
    if (error || !data?.length) return
    const { error: rmErr } = await admin.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`))
    if (rmErr) throw new Error(rmErr.message)
    if (data.length < 1000) return
  }
}

Deno.serve(async () => {
  const { data: due, error } = await admin.rpc('due_account_deletions')
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  const done: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of (due ?? []) as string[]) {
    try {
      for (const b of BUCKETS) await removeFolder(b, id)
      const { error: delErr } = await admin.auth.admin.deleteUser(id)
      if (delErr) throw new Error(delErr.message)
      done.push(id)
    } catch (e) {
      failed.push({ id, error: (e as Error).message })
    }
  }
  return Response.json({ ok: failed.length === 0, deleted: done.length, failed })
})
