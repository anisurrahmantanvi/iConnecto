export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface ImageRules {
  maxBytes: number
  types?: string[]
}

/** Returns an error message, or null when the file is acceptable. */
export function validateImage(file: File, rules: ImageRules): string | null {
  const types = rules.types ?? IMAGE_TYPES
  if (!types.includes(file.type)) return 'Unsupported file type. Use JPEG, PNG or WebP.'
  if (file.size > rules.maxBytes) return `File is too large (max ${Math.round(rules.maxBytes / 1048576)} MB).`
  return null
}

/**
 * Downscales and re-encodes an image in the browser before upload to save storage and bandwidth.
 * GIFs are returned untouched (re-encoding would drop the animation).
 */
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export function extensionFor(type: string): string {
  switch (type) {
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
    default: return 'jpg'
  }
}
