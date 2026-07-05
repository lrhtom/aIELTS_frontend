/**
 * Build a full media URL from whatever the backend stored.
 *
 * The DB now holds a relative key (e.g. `avatars/user_1_ab12.jpg`) instead of
 * a fully-qualified URL, because dev (`localhost:8000`) and prod
 * (`47.85.195.208:8000`) share the same MySQL and a baked-in origin would
 * poison the other environment's rows.
 *
 * `bg_image_url` is polymorphic — users can paste an external image URL, so
 * anything starting with `http://` / `https://` / `data:` / `blob:` passes
 * through unchanged.
 */

const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE ?? '/media').replace(/\/+$/, '')

export function mediaUrl(value?: string | null): string {
  if (!value) return ''
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value
  // Strip a leading `/media/` (old rows stored the fully-prefixed path); we always
  // want a media-relative key so MEDIA_BASE isn't accidentally duplicated.
  const key = value.replace(/^\/+/, '').replace(/^media\/+/, '')
  return `${MEDIA_BASE}/${key}`
}

/**
 * Resolve a listening/writing map image src from the two fields the backend may
 * emit: preferred relative `imagePath` (new, dev/prod unified) OR legacy
 * absolute `imageUrl` (old records). Both funnel through `mediaUrl()`.
 */
export function mapImageSrc(imagePath?: string | null, imageUrl?: string | null): string {
  if (imagePath) return mediaUrl(imagePath)
  if (imageUrl) return mediaUrl(imageUrl)
  return ''
}
