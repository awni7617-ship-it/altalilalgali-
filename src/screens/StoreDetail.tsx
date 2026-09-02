import { useState } from 'react'
import { APP, categoryLabel } from '../config'
import { clockTime, dayLabel, discountPercent, minutesUntilClose, money, pickupWindow } from '../lib/format'
import { distanceKm, formatDistance } from '../lib/geo'
import type { Order, Store } from '../lib/types'
import { useApp } from '../state/app'
import { Photo, usePhoto } from '../components/Photo'
import { Sheet, Stepper } from '../components/ui'
import { Bag, ChevronLeft, Clock, Heart, Leaf, Pencil, Pin, Star, Trash } from '../components/icons'

interface Props {
  store: Store
  onBack: () => void
  onReserved: (order: Order) => void
  onEdit: () => void
}

export function StoreDetail({ store, onBack, onReserved, onEdit }: Props) {
  const { favorites, toggleFavorite, coords, bagsLeftFor, reserve, deleteStore, isAdmin, notify } =
    useApp()

  const [photoIndex, setPhotoIndex] = useState(0)
  const [qty, setQty] = useState(1)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)

  const left = bagsLeftFor(store)
  const soldOut = left <= 0
  const isFav = favorites.includes(store.id)
  const off = discountPercent(store.price, store.originalValue)
  const away =
    coords && store.lat !== null && store.lng !== null
      ? formatDistance(distanceKm(coords, { lat: store.lat, lng: store.lng }))
      : null
  const closesIn = minutesUntilClose(store.pickupDay, store.pickupEnd)
  const heroId = store.photoIds[photoIndex] ?? store.photoIds[0] ?? null
  const heroSrc = usePhoto(heroId)

  const confirmReserve = async () => {
    setBusy(true)
    try {
      const order = await reserve(store, qty)
      setConfirming(false)
      onReserved(order)
    } catch {
      notify('That could not be reserved. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await deleteStore(store)
      notify(`${store.name} was removed.`)
      onBack()
    } catch {
      notify('That shop could not be removed.', 'error')
    } finally {
      setBusy(false)
      setDeleting(false)
    }
  }

  return (
    <div className="scroll">
      <div className="detail-hero">
        {heroSrc || !heroId ? (
          <Photo id={heroId} alt={`${store.name}`} />
        ) : (
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        )}

        <div className="hero-nav">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <button
            className="icon-btn"
            aria-pressed={isFav}
            aria-label={isFav ? 'Remove from favourites' : 'Save to favourites'}
            onClick={() => toggleFavorite(store.id)}
            style={isFav ? { color: 'var(--hot)' } : undefined}
          >
            <Heart size={19} fill={isFav} />
          </button>
        </div>

        {store.photoIds.length > 1 && (
          <div className="hero-dots">
            {store.photoIds.map((id, i) => (
              <button
                key={id}
                className={`hero-dot${i === photoIndex ? ' is-on' : ''}`}
                onClick={() => setPhotoIndex(i)}
                aria-label={`Photo ${i + 1} of ${store.photoIds.length}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="sheet-body">
        <div className="row" style={{ alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <span className="logo" style={{ width: 48, height: 48 }}>
            {store.logoId ? <Photo id={store.logoId} alt="" /> : store.name.charAt(0).toUpperCase()}
          </span>
          <div className="grow">
            <h1 className="h1" style={{ fontSize: 24 }}>
              {store.name}
            </h1>
            <div className="card-meta" style={{ marginTop: 5 }}>
              <span className="rating">
                <Star size={13} fill />
                {store.rating.toFixed(1)}
              </span>
              {store.ratingCount > 0 && <span>({store.ratingCount})</span>}
              <i className="dot" />
              <span>{categoryLabel(store.category)}</span>
              {away && (
                <>
                  <i className="dot" />
                  <span>{away}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {store.description && (
          <p className="body" style={{ marginTop: 12 }}>
            {store.description}
          </p>
        )}

        <div style={{ height: 18 }} />

        <div className="panel bag-panel">
          <div className="row-between">
            <div>
              <p className="eyebrow" style={{ color: 'inherit', opacity: 0.72 }}>
                {store.bagTitle || APP.bagTerm}
              </p>
              <div className="card-price" style={{ marginTop: 4 }}>
                <span className="price">{money(store.price)}</span>
                {store.originalValue > store.price && (
                  <span className="price-was">{money(store.originalValue)}</span>
                )}
              </div>
            </div>
            <span className="panel-icon" style={{ background: 'rgba(255,255,255,.16)', color: 'inherit' }}>
              <Bag size={20} />
            </span>
          </div>

          <div
            className="row-between"
            style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.18)' }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5 }}>
                {soldOut ? 'All gone for now' : `${left} ${left === 1 ? 'bag' : 'bags'} left`}
              </p>
              {off > 0 && (
                <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.75 }}>
                  {off}% off the usual value
                </p>
              )}
            </div>
            {!soldOut && (
              <Stepper value={qty} min={1} max={Math.min(left, 5)} onChange={setQty} label="bags" />
            )}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panel-row">
            <span className="panel-icon">
              <Clock size={19} />
            </span>
            <div className="grow">
              <p className="h3">Collect {dayLabel(store.pickupDay).toLowerCase()}</p>
              <p className="small mono" style={{ marginTop: 2 }}>
                {pickupWindow(store.pickupStart, store.pickupEnd)}
              </p>
            </div>
            {closesIn > 0 && closesIn < 180 && (
              <span className="badge is-low" style={{ position: 'static' }}>
                {closesIn}m left
              </span>
            )}
          </div>

          {store.address && (
            <div className="panel-row">
              <span className="panel-icon">
                <Pin size={19} />
              </span>
              <div className="grow">
                <p className="h3">Pick-up point</p>
                <p className="small" style={{ marginTop: 2 }}>
                  {store.address}
                </p>
              </div>
              {store.lat !== null && store.lng !== null && (
                <a
                  className="btn btn-secondary btn-sm"
                  href={`https://maps.google.com/?q=${store.lat},${store.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Directions
                </a>
              )}
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="panel-icon">
              <Leaf size={19} />
            </span>
            <h2 className="h3">What you could get</h2>
          </div>
          <p className="body">
            {store.whatYouGet?.trim() ||
              `A ${store.bagTitle || APP.bagTerm} of good food this shop has left at the end of the day. The exact contents are a surprise — that is what keeps it out of the bin.`}
          </p>
        </div>

        {isAdmin && (
          <div className="panel" style={{ marginTop: 12 }}>
            <p className="eyebrow" style={{ marginBottom: 10 }}>
              Admin
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-secondary btn-sm grow" onClick={onEdit}>
                <Pencil size={16} /> Edit shop
              </button>
              <button className="btn btn-danger btn-sm grow" onClick={() => setDeleting(true)}>
                <Trash size={16} /> Delete
              </button>
            </div>
          </div>
        )}

        <div className="sticky-cta">
          <button
            className="btn btn-primary"
            disabled={soldOut}
            onClick={() => setConfirming(true)}
          >
            {soldOut ? 'Sold out' : `Reserve ${qty > 1 ? `${qty} bags` : 'bag'} · ${money(store.price * qty)}`}
          </button>
        </div>
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Confirm reservation">
        <div className="panel">
          <div className="row-between">
            <span className="small">{store.bagTitle || APP.bagTerm}</span>
            <span style={{ fontWeight: 700 }}>× {qty}</span>
          </div>
          <div className="row-between" style={{ marginTop: 10 }}>
            <span className="small">Collect {dayLabel(store.pickupDay).toLowerCase()}</span>
            <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>
              {clockTime(store.pickupStart)}–{clockTime(store.pickupEnd)}
            </span>
          </div>
          <hr className="divider" style={{ margin: '14px 0' }} />
          <div className="row-between">
            <span style={{ fontWeight: 700 }}>Total</span>
            <span className="price">{money(store.price * qty)}</span>
          </div>
        </div>
        <p className="hint" style={{ margin: '12px 2px 16px' }}>
          You pay at the shop when you collect. Bring the code on the next screen.
        </p>
        <button className="btn btn-primary" onClick={confirmReserve} disabled={busy}>
          {busy ? 'Reserving…' : 'Reserve now'}
        </button>
      </Sheet>

      <Sheet open={deleting} onClose={() => setDeleting(false)} title={`Delete ${store.name}?`}>
        <p className="body" style={{ marginBottom: 18 }}>
          This removes the shop and its photos for everyone. Reservations people already hold are
          not cancelled.
        </p>
        <div className="stack-8">
          <button className="btn btn-danger" onClick={confirmDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete shop'}
          </button>
          <button className="btn btn-secondary" onClick={() => setDeleting(false)}>
            Keep it
          </button>
        </div>
      </Sheet>
    </div>
  )
}
