import { supabase } from '@/lib/supabase'

export interface PageLite { id: string; slug: string; name: string; avatar_url: string | null }

/** Which of these posts were written as a page. Never throws: before the database update there are no pages. */
export async function fetchPageLinks(postIds: string[]): Promise<Map<string, PageLite>> {
  const map = new Map<string, PageLite>()
  if (!postIds.length) return map
  try {
    const { data, error } = await supabase.from('page_posts').select('post_id, page:pages(id, slug, name, avatar_url)').in('post_id', postIds)
    if (error || !data) return map
    for (const r of data as unknown as { post_id: string; page: PageLite | null }[]) if (r.page) map.set(r.post_id, r.page)
  } catch { /* ignore */ }
  return map
}
