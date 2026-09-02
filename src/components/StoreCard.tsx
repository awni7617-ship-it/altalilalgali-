import { categoryLabel } from '../config'
import { collectLine, discountPercent, money } from '../lib/format'
import { distanceKm, formatDistance } from '../lib/geo'
import type { Coords, Store } from '../lib/types'
import { Clock, Heart, Star } from './icons'
import { Photo } from './Photo'

interface Props {
  store: Store
  left: number
  isFavorite: boolean
  coords: Coords | null
  onOpen: () => void
  onToggleFavorite: () => void
  /** Full-width row inside a vertical list, rather than a carousel tile. */
  wide?: boolean
}

export function StoreCard({
  store,
  left,
  isFavorite,
  coords,
  onOpen,
  onToggleFavorite,
  wide,
}: Props) {
  const soldOut = left <= 0
  const off = discountPercent(store.price, store.originalValue)
  const away =
    coords && store.lat !== null && store.lng !== null
      ? formatDistance(distanceKm(coords, { lat: store.lat, lng: store.lng }))
      : null

  const badge = soldOut
    ? { text: 'Sold out', cls: 'badge is-out' }
    : left <= 2
      ? { text: `${left} left`, cls: 'badge is-low' }
      : { text: `${left} left`, cls: 'badge' }

  return (
    <article className={`card${soldOut ? ' is-sold' : ''}`} style={wide ? { width: '100%' } : undefined}>
      <button
        className="card-media"
        onClick={onOpen}
        aria-label={`${store.name}, ${money(store.price)}, ${badge.text}`}
        style={{ width: '100%', display: 'block' }}
      >
        <Photo id={store.photoIds[0]} alt="" />
        <span className="card-collect">
          <Clock size={14} />
          {collectLine(store.pickupDay, store.pickupStart, store.pickupEnd)}
        </span>
      </button>

      <div className="card-top">
        <span className={badge.cls}>{badge.text}</span>
        <button
          className="fav"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${store.name} from favourites` : `Save ${store.name} to favourites`}
          onClick={onToggleFavorite}
        >
          <Heart size={17} fill={isFavorite} />
        </button>
      </div>

      <button className="card-body" onClick={onOpen} style={{ width: '100%' }}>
        <span className="logo">
          {store.logoId ? (
            <Photo id={store.logoId} alt="" />
          ) : (
            store.name.trim().charAt(0).toUpperCase() || '?'
          )}
        </span>

        <span className="card-lines">
          <span className="card-name">{store.name}</span>
          <span className="card-meta">
            <span className="rating">
              <Star size={13} fill />
              {store.rating.toFixed(1)}
            </span>
            <i className="dot" />
            <span className="truncate">{categoryLabel(store.category)}</span>
            {away && (
              <>
                <i className="dot" />
                <span>{away}</span>
              </>
            )}
          </span>
          <span className="card-price">
            <span className="price">{money(store.price)}</span>
            {store.originalValue > store.price && (
              <span className="price-was">{money(store.originalValue)}</span>
            )}
            {off > 0 && <span className="save-pill">-{off}%</span>}
          </span>
        </span>
      </button>
    </article>
  )
}
