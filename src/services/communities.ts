import { supabase } from '@/lib/supabase'
import { check, isDuplicate, PAGE_SIZE, PROFILE_LITE } from '@/lib/api'
import { sanitizeSearch, slugify } from '@/lib/format'
import type { Community, CommunityMember, CommunityRole, Page } from '@/types/db'
import { removeImages, uploadImage } from './storage'

const COMMUNITY_COLS = 'id, name, slug, description, avatar_url, is_private, owner_id, member_count, created_at'

export async function listCommunities(query: string, cursor: string | null): Promise<Page<Community>> {
  const offset = cursor ? Number(cursor) : 0
  let q = supabase.from('communities').select(COMMUNITY_COLS).order('member_count', { ascending: false }).order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
  const term = sanitizeSearch(query)
  if (term.length >= 2) q = q.ilike('name', `%${term}%`)
  const items = check(await q) as Community[]
  return { items, nextCursor: items.length === PAGE_SIZE ? String(offset + PAGE_SIZE) : null }
}

export async function myCommunities(userId: string): Promise<Community[]> {
  const rows = check(
    await supabase.from('community_members').select(`community:communities(${COMMUNITY_COLS})`).eq('user_id', userId).limit(100),
  ) as unknown as { community: Community | null }[]
  return rows.map((r) => r.community).filter((c): c is Community => !!c)
}

export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  const res = await supabase.from('communities').select(COMMUNITY_COLS).ilike('slug', slug).maybeSingle()
  return check(res) as Community | null
}

/** Used to turn a notification's community_id into a link to the community page. */
export async function getCommunityById(id: string): Promise<Community | null> {
  const res = await supabase.from('communities').select(COMMUNITY_COLS).eq('id', id).maybeSingle()
  return check(res) as Community | null
}

export async function getMyRole(communityId: string, userId: string): Promise<CommunityRole | null> {
  const res = await supabase.from('community_members').select('role').eq('community_id', communityId).eq('user_id', userId).maybeSingle()
  const row = check(res) as { role: CommunityRole } | null
  return row?.role ?? null
}

export interface CommunityInput {
  name: string
  slug?: string
  description: string
  isPrivate: boolean
  image?: File | null
}

export async function createCommunity(userId: string, input: CommunityInput): Promise<Community> {
  const name = input.name.trim()
  if (name.length < 2) throw new Error('Give your community a name (at least 2 characters).')
  const slug = slugify(input.slug?.trim() || name)
  if (slug.length < 3) throw new Error('The community address must be at least 3 letters or numbers.')
  let avatar: string | null = null
  if (input.image) avatar = await uploadImage('community-images', userId, input.image)
  try {
    const res = await supabase
      .from('communities')
      .insert({ name, slug, description: input.description.trim() || null, is_private: input.isPrivate, avatar_url: avatar })
      .select(COMMUNITY_COLS)
      .single()
    return check(res) as Community
  } catch (e) {
    if (avatar) void removeImages('community-images', [avatar])
    if (isDuplicate(e)) throw new Error('That community address is already taken.')
    throw e
  }
}

export async function updateCommunity(userId: string, community: Community, input: Omit<CommunityInput, 'slug'>): Promise<Community> {
  let avatar = community.avatar_url
  let uploaded: string | null = null
  if (input.image) {
    uploaded = await uploadImage('community-images', userId, input.image)
    avatar = uploaded
  }
  try {
    const res = await supabase
      .from('communities')
      .update({ name: input.name.trim(), description: input.description.trim() || null, is_private: input.isPrivate, avatar_url: avatar })
      .eq('id', community.id)
      .select(COMMUNITY_COLS)
      .single()
    const updated = check(res) as Community
    if (uploaded && community.avatar_url) void removeImages('community-images', [community.avatar_url])
    return updated
  } catch (e) {
    if (uploaded) void removeImages('community-images', [uploaded])
    throw e
  }
}

export async function deleteCommunity(id: string): Promise<void> {
  const { error } = await supabase.from('communities').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function joinCommunity(communityId: string): Promise<void> {
  const { error } = await supabase.from('community_members').insert({ community_id: communityId })
  if (error && !isDuplicate(error)) throw new Error(error.message)
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function listMembers(communityId: string, cursor: string | null): Promise<Page<CommunityMember>> {
  let q = supabase
    .from('community_members')
    .select(`community_id, user_id, role, joined_at, profile:profiles!user_id(${PROFILE_LITE})`)
    .eq('community_id', communityId)
    .order('joined_at', { ascending: true })
    .limit(PAGE_SIZE)
  if (cursor) q = q.gt('joined_at', cursor)
  const items = check(await q) as unknown as CommunityMember[]
  return { items, nextCursor: items.length === PAGE_SIZE ? items[items.length - 1].joined_at : null }
}

export async function removeMember(communityId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function setMemberRole(communityId: string, userId: string, role: 'member' | 'moderator'): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', { p_community: communityId, p_user: userId, p_role: role })
  if (error) throw new Error(error.message)
}
