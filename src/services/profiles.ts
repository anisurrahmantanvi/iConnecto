import { supabase } from '@/lib/supabase'
import { check, PAGE_SIZE, PROFILE_FULL, PROFILE_LITE } from '@/lib/api'
import { escapeLike, sanitizeSearch } from '@/lib/format'
import type { Page, Profile, ProfileAbout, ProfileLite } from '@/types/db'
import { removeImages, uploadImage } from './storage'

export async function getProfileById(id: string): Promise<Profile | null> {
  const res = await supabase.from('profiles').select(PROFILE_FULL).eq('id', id).maybeSingle()
  return check(res) as Profile | null
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const res = await supabase.from('profiles').select(PROFILE_FULL).ilike('username', escapeLike(username)).maybeSingle()
  return check(res) as Profile | null
}

/** Loads the signed-in user's profile, creating it through the server function if it is missing. */
export async function loadOrCreateMyProfile(userId: string): Promise<Profile> {
  const existing = await getProfileById(userId)
  if (existing) return existing
  const created = check(await supabase.rpc('ensure_my_profile')) as Profile
  const full = await getProfileById(created.id)
  if (!full) throw new Error('Your profile could not be created. Please sign out and in again.')
  return full
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const res = await supabase.rpc('username_available', { p_username: username })
  return check(res) === true
}

export interface ProfilePatch {
  username?: string
  display_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  cover_url?: string | null
}

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  const res = await supabase.from('profiles').update(patch).eq('id', userId).select(PROFILE_FULL).single()
  return check(res) as Profile
}

export async function changeAvatar(userId: string, file: File, previousUrl: string | null): Promise<Profile> {
  const url = await uploadImage('avatars', userId, file)
  try {
    const profile = await updateMyProfile(userId, { avatar_url: url })
    if (previousUrl) void removeImages('avatars', [previousUrl])
    return profile
  } catch (e) {
    void removeImages('avatars', [url])
    throw e
  }
}

/** Uploads a new cover photo (or removes it when `file` is null) and deletes the old file. */
export async function changeCover(userId: string, file: File | null, previousUrl: string | null): Promise<Profile> {
  if (!file) {
    const profile = await updateMyProfile(userId, { cover_url: null })
    if (previousUrl) void removeImages('covers', [previousUrl])
    return profile
  }
  const url = await uploadImage('covers', userId, file)
  try {
    const profile = await updateMyProfile(userId, { cover_url: url })
    if (previousUrl) void removeImages('covers', [previousUrl])
    return profile
  } catch (e) {
    void removeImages('covers', [url])
    throw e
  }
}

const ABOUT_COLS = 'work, education, location, relationship_status'

/** Work / education / location / relationship status. Kept out of the main profile query on purpose. */
export async function getProfileAbout(userId: string): Promise<ProfileAbout | null> {
  const res = await supabase.from('profiles').select(ABOUT_COLS).eq('id', userId).maybeSingle()
  return check(res) as ProfileAbout | null
}

export async function updateMyAbout(userId: string, about: ProfileAbout): Promise<ProfileAbout> {
  const res = await supabase.from('profiles').update(about).eq('id', userId).select(ABOUT_COLS).single()
  return check(res) as ProfileAbout
}

export async function searchProfiles(query: string, cursor: string | null): Promise<Page<ProfileLite>> {
  const q = sanitizeSearch(query)
  if (q.length < 2) return { items: [], nextCursor: null }
  const offset = cursor ? Number(cursor) : 0
  const res = await supabase
    .from('profiles')
    .select(PROFILE_LITE)
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order('username', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)
  const items = check(res) as ProfileLite[]
  return { items, nextCursor: items.length === PAGE_SIZE ? String(offset + PAGE_SIZE) : null }
}

/** A few people to follow: newest profiles that the user does not follow yet (server-side filter, see migration 0008). */
export async function suggestedProfiles(_userId: string, limit = 8): Promise<ProfileLite[]> {
  const res = await supabase.rpc('suggested_profiles', { p_limit: limit })
  const rows = check(res) as ProfileLite[] | null
  return (rows ?? []).map((p) => ({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }))
}
