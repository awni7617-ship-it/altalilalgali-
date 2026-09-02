import { useEffect, useState } from 'react'
import { getMedia } from '../lib/repo'
import { Bag } from './icons'

/** Resolve a media id to its data URI. Returns null while loading or missing. */
export function usePhoto(id: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setSrc(null)
    if (!id) return
    void getMedia(id).then((v) => {
      if (alive) setSrc(v)
    })
    return () => {
      alive = false
    }
  }, [id])
  return src
}

/**
 * A photo that always occupies its slot: skeleton while loading, a bag glyph
 * when there is no photo at all, so cards never jump as images arrive.
 */
export function Photo({
  id,
  alt,
  className,
}: {
  id: string | null | undefined
  alt: string
  className?: string
}) {
  const src = usePhoto(id)

  if (!id) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
        }}
      >
        <Bag size={34} />
      </div>
    )
  }

  if (!src) return <div className={`skeleton ${className ?? ''}`} style={{ width: '100%', height: '100%' }} />

  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />
}
