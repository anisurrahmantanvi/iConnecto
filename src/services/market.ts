import { supabase } from '@/lib/supabase'

export interface MarketCategory { id: string; slug: string; name: string; name_bn: string | null; kind: 'physical' | 'digital' | 'service'; sort: number }

/** Returns null when the marketplace tables are not installed yet (before the database update). */
export async function listCategories(): Promise<MarketCategory[] | null> {
  const { data, error } = await supabase.from('dealsafe_categories').select('id, slug, name, name_bn, kind, sort').order('sort')
  if (error) return null
  return (data ?? []) as MarketCategory[]
}
