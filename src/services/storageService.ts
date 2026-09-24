import { supabase } from '@/lib/supabase'

const BUCKET = 'person-photos'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export class PhotoValidationError extends Error {}

function assertValidPhoto(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new PhotoValidationError('Please choose a JPEG, PNG, WEBP or GIF image.')
  }
  if (file.size > MAX_BYTES) {
    throw new PhotoValidationError('Please choose an image under 5 MB.')
  }
}

export async function uploadPersonPhoto(treeId: string, personId: string, file: File): Promise<string> {
  assertValidPhoto(file)

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${treeId}/${personId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deletePersonPhoto(publicUrl: string): Promise<void> {
  const marker = `/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return
  const path = publicUrl.slice(idx + marker.length)
  await supabase.storage.from(BUCKET).remove([path])
}
