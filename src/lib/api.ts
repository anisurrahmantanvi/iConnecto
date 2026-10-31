export const PAGE_SIZE = 15

interface Result<T> {
  data: T
  error: { message: string; code?: string } | null
}

/** Throws on a Supabase error, otherwise returns the data. */
export function check<T>(res: Result<T>): T {
  if (res.error) {
    const err = new Error(res.error.message) as Error & { code?: string }
    err.code = res.error.code
    throw err
  }
  return res.data
}

export function isDuplicate(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '23505'
}

export const PROFILE_LITE = 'id, username, display_name, avatar_url, badge'
export const PROFILE_FULL =
  'id, username, display_name, bio, avatar_url, cover_url, badge, followers_count, following_count, posts_count, created_at'
