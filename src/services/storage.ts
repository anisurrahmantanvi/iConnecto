import { supabase } from '@/lib/supabase'
import { compressImage, extensionFor, validateImage } from '@/lib/image'

export type Bucket = 'avatars' | 'post-media' | 'community-images'

const LIMITS: Record<Bucket, { maxBytes: number; maxDim: number }> = {
  avatars: { maxBytes: 2 * 1024 * 1024, maxDim: 512 },
  'post-media': { maxBytes: 5 * 1024 * 1024, maxDim: 1600 },
  'community-images': { maxBytes: 2 * 1024 * 1024, maxDim: 800 },
}

function randomName(ext: string): string {
  const id = crypto.randomUUID()
  return `${Date.now()}-${id.slice(0, 8)}.${ext}`
}

/**
 * Validates, compresses and uploads an image into "<bucket>/<userId>/<file>".
 * The storage policies only allow writing inside the signed-in user's own folder.
 */
export async function uploadImage(bucket: Bucket, userId: string, file: File): Promise<string> {
  const limits = LIMITS[bucket]
  // Check the original against a generous cap; the compressed result must fit the bucket limit.
  const problem = validateImage(file, { maxBytes: limits.maxBytes * 4 })
  if (problem) throw new Error(problem)

  const blob = await compressImage(file, limits.maxDim)
  if (blob.size > limits.maxBytes) throw new Error(`Image is still too large after compression (max ${Math.round(limits.maxBytes / 1048576)} MB).`)

  const type = blob.type || file.type
  const path = `${userId}/${randomName(extensionFor(type))}`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

function pathFromPublicUrl(bucket: Bucket, url: string): string | null {
  const marker = `/object/public/${bucket}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0])
}

/** Best-effort cleanup of uploaded files (failed posts, removed avatars). Never throws. */
export async function removeImages(bucket: Bucket, urls: string[]): Promise<void> {
  const paths = urls.map((u) => pathFromPublicUrl(bucket, u)).filter((p): p is string => !!p)
  if (!paths.length) return
  try {
    await supabase.storage.from(bucket).remove(paths)
  } catch {
    /* orphaned files are harmless; ignore */
  }
}
