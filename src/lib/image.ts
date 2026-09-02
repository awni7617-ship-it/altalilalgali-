/**
 * Photo intake. Phone cameras hand back 3-8 MB JPEGs; the cloud store caps a
 * document at 256 KiB. So every photo is re-encoded down to a target byte size
 * before it is ever stored, and the caller only ever sees a small data URI.
 */

const MAX_EDGE = 1280
const TARGET_BYTES = 150_000
const MIN_QUALITY = 0.45

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}

/**
 * Resize to fit MAX_EDGE, then step quality down until the encoded result fits
 * TARGET_BYTES. Returns a JPEG data URI.
 */
export async function compressImage(file: File): Promise<string> {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not process the image.')
  ctx.drawImage(img, 0, 0, w, h)

  let quality = 0.82
  let out = canvas.toDataURL('image/jpeg', quality)
  while (out.length > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1
    out = canvas.toDataURL('image/jpeg', quality)
  }
  return out
}

/** Average colour of a data URI, used as the placeholder behind a loading photo. */
export function averageColor(dataUri: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 1
      const ctx = c.getContext('2d')
      if (!ctx) return resolve('#DCE3DC')
      ctx.drawImage(img, 0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      resolve(`rgb(${r}, ${g}, ${b})`)
    }
    img.onerror = () => resolve('#DCE3DC')
    img.src = dataUri
  })
}
