import { useEffect, useRef, useState } from 'react'
import { APP, CATEGORIES, type CategoryId } from '../config'
import { compressImage } from '../lib/image'
import { requestLocation, locationMessage } from '../lib/geo'
import { deleteMedia, getMedia, putMedia } from '../lib/repo'
import { emptyStore, type PickupDay, type Store } from '../lib/types'
import { useApp } from '../state/app'
import { Field, Segmented } from '../components/ui'
import { Camera, Check, ChevronLeft, Crosshair, Plus, X } from '../components/icons'

const MAX_PHOTOS = 4

/** A photo in the editor: `id` is null until it has been written to the store. */
interface Draft {
  key: string
  id: string | null
  src: string
}

type Errors = Partial<Record<'name' | 'address' | 'price' | 'originalValue' | 'quantity' | 'time', string>>

export function StoreForm({
  existing,
  onBack,
  onSaved,
}: {
  existing: Store | null
  onBack: () => void
  onSaved: (store: Store) => void
}) {
  const { saveStore, notify } = useApp()
  const [form, setForm] = useState<Store>(() => existing ?? emptyStore())
  const [photos, setPhotos] = useState<Draft[]>([])
  const [logo, setLogo] = useState<Draft | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)

  const photoInput = useRef<HTMLInputElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  // Pull existing photos back out of the store so the editor shows them.
  useEffect(() => {
    if (!existing) return
    let alive = true
    void (async () => {
      const loaded = await Promise.all(
        existing.photoIds.map(async (id) => ({ key: id, id, src: (await getMedia(id)) ?? '' })),
      )
      if (alive) setPhotos(loaded.filter((p) => p.src))
      if (existing.logoId) {
        const src = await getMedia(existing.logoId)
        if (alive && src) setLogo({ key: existing.logoId, id: existing.logoId, src })
      }
    })()
    return () => {
      alive = false
    }
  }, [existing])

  const set = <K extends keyof Store>(key: K, value: Store[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) return notify(`Up to ${MAX_PHOTOS} photos.`, 'error')

    try {
      const next = await Promise.all(
        Array.from(files)
          .slice(0, room)
          .map(async (f) => ({ key: crypto.randomUUID(), id: null, src: await compressImage(f) })),
      )
      setPhotos((p) => [...p, ...next])
    } catch (err) {
      notify(err instanceof Error ? err.message : 'That photo could not be read.', 'error')
    }
  }

  const pickLogo = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    try {
      if (logo?.id) setRemoved((r) => [...r, logo.id!])
      setLogo({ key: crypto.randomUUID(), id: null, src: await compressImage(file) })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'That photo could not be read.', 'error')
    }
  }

  const dropPhoto = (key: string) => {
    setPhotos((p) => {
      const gone = p.find((x) => x.key === key)
      if (gone?.id) setRemoved((r) => [...r, gone.id!])
      return p.filter((x) => x.key !== key)
    })
  }

  const useMyLocation = async () => {
    setLocating(true)
    const result = await requestLocation()
    setLocating(false)
    if (!result.ok) return notify(locationMessage[result.reason], 'error')
    setForm((f) => ({ ...f, lat: +result.coords.lat.toFixed(6), lng: +result.coords.lng.toFixed(6) }))
    notify('Location saved for this shop.')
  }

  const validate = (): Errors => {
    const e: Errors = {}
    if (!form.name.trim()) e.name = 'Give the shop a name.'
    if (!form.address.trim()) e.address = 'Shoppers need an address to find it.'
    if (!(form.price >= 0)) e.price = 'Enter a price.'
    if (!(form.originalValue >= form.price)) e.originalValue = 'Value should be at least the price.'
    if (!(form.quantity >= 1)) e.quantity = 'At least one bag.'
    if (form.pickupEnd <= form.pickupStart) e.time = 'The window has to end after it starts.'
    return e
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) {
      notify('Check the highlighted fields.', 'error')
      return
    }

    setBusy(true)
    try {
      // Write new photos first so the saved record only ever points at real media.
      const photoIds = await Promise.all(photos.map((p) => p.id ?? putMedia(p.src)))
      const logoId = logo ? (logo.id ?? (await putMedia(logo.src))) : null

      const record: Store = {
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        description: form.description.trim(),
        whatYouGet: form.whatYouGet.trim(),
        bagTitle: form.bagTitle.trim() || APP.bagTerm,
        photoIds,
        logoId,
      }

      await saveStore(record)
      await Promise.all(removed.map((id) => deleteMedia(id).catch(() => undefined)))
      notify(existing ? `${record.name} updated.` : `${record.name} is live.`)
      onSaved(record)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'That could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <h1 className="h2 grow">{existing ? 'Edit shop' : 'Add a shop'}</h1>
      </header>

      <form className="pad" onSubmit={submit} style={{ paddingBottom: 8 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          Photos
        </p>
        <div className="photo-grid" style={{ marginBottom: 8 }}>
          {photos.map((p, i) => (
            <div className="photo-cell" key={p.key}>
              <img src={p.src} alt="" />
              {i === 0 && <span className="cover-tag">Cover</span>}
              <button
                type="button"
                className="photo-remove"
                onClick={() => dropPhoto(p.key)}
                aria-label="Remove photo"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" className="photo-add" onClick={() => photoInput.current?.click()}>
              <Camera size={20} />
              Add photo
            </button>
          )}
        </div>
        <p className="hint" style={{ marginBottom: 20 }}>
          The first photo is the cover shoppers see. Photos are resized before they are saved.
        </p>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void addPhotos(e.target.files)
            e.target.value = ''
          }}
        />

        <Field label="Shop name" error={errors.name}>
          <input
            className={`input${errors.name ? ' field-error' : ''}`}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Blue Door Bakery"
            autoComplete="off"
          />
        </Field>

        <Field label="Logo" hint="Optional. Shown as the round badge on the card.">
          <div className="row">
            <span className="logo" style={{ width: 48, height: 48 }}>
              {logo ? <img src={logo.src} alt="" /> : form.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => logoInput.current?.click()}>
              {logo ? 'Replace' : 'Upload'}
            </button>
            {logo && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (logo.id) setRemoved((r) => [...r, logo.id!])
                  setLogo(null)
                }}
              >
                Remove
              </button>
            )}
          </div>
        </Field>
        <input
          ref={logoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void pickLogo(e.target.files)
            e.target.value = ''
          }}
        />

        <Field label="Category">
          <select
            className="select"
            value={form.category}
            onChange={(e) => set('category', e.target.value as CategoryId)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="About the shop" hint="One or two lines, in the shop's own voice.">
          <textarea
            className="textarea"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="A family bakery on the corner, baking sourdough since 1998."
          />
        </Field>

        <hr className="divider" />
        <p className="eyebrow" style={{ marginBottom: 12 }}>
          Where to collect
        </p>

        <Field label="Address" error={errors.address}>
          <input
            className={`input${errors.address ? ' field-error' : ''}`}
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="12 Mill Lane, Riverside"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Map position"
          hint="Used for distance and the Nearby map. Stand at the shop and tap the button, or type the coordinates."
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={useMyLocation}
            disabled={locating}
            style={{ width: '100%', marginBottom: 10 }}
          >
            <Crosshair size={16} />
            {locating ? 'Finding…' : 'Use my current location'}
          </button>
          <div className="row-2">
            <input
              className="input"
              value={form.lat ?? ''}
              onChange={(e) => set('lat', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="Latitude"
              inputMode="decimal"
              type="number"
              step="any"
            />
            <input
              className="input"
              value={form.lng ?? ''}
              onChange={(e) => set('lng', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="Longitude"
              inputMode="decimal"
              type="number"
              step="any"
            />
          </div>
        </Field>

        <hr className="divider" />
        <p className="eyebrow" style={{ marginBottom: 12 }}>
          The bag
        </p>

        <Field label="What it is called">
          <input
            className="input"
            value={form.bagTitle}
            onChange={(e) => set('bagTitle', e.target.value)}
            placeholder={APP.bagTerm}
          />
        </Field>

        <div className="row-2">
          <Field label={`Price (${APP.currencySymbol})`} error={errors.price}>
            <input
              className={`input${errors.price ? ' field-error' : ''}`}
              value={form.price}
              onChange={(e) => set('price', Number(e.target.value))}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
            />
          </Field>
          <Field label="Usual value" error={errors.originalValue}>
            <input
              className={`input${errors.originalValue ? ' field-error' : ''}`}
              value={form.originalValue}
              onChange={(e) => set('originalValue', Number(e.target.value))}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
            />
          </Field>
        </div>

        <Field label="Bags available today" error={errors.quantity}>
          <input
            className={`input${errors.quantity ? ' field-error' : ''}`}
            value={form.quantity}
            onChange={(e) => set('quantity', Number(e.target.value))}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
          />
        </Field>

        <Field label="Collection day">
          <Segmented<PickupDay>
            value={form.pickupDay}
            label="Collection day"
            options={[
              { id: 'today', label: 'Today' },
              { id: 'tomorrow', label: 'Tomorrow' },
            ]}
            onChange={(v) => set('pickupDay', v)}
          />
        </Field>

        <Field label="Collection window" error={errors.time}>
          <div className="row-2">
            <input
              className={`input${errors.time ? ' field-error' : ''}`}
              value={form.pickupStart}
              onChange={(e) => set('pickupStart', e.target.value)}
              type="time"
            />
            <input
              className={`input${errors.time ? ' field-error' : ''}`}
              value={form.pickupEnd}
              onChange={(e) => set('pickupEnd', e.target.value)}
              type="time"
            />
          </div>
        </Field>

        <Field label="What you could get" hint="Shoppers see this on the shop page.">
          <textarea
            className="textarea"
            value={form.whatYouGet}
            onChange={(e) => set('whatYouGet', e.target.value)}
            placeholder="Could contain sourdough, croissants and whatever pastries are left."
          />
        </Field>

        <Field label="Rating" hint="Shown on the card. Set it from real reviews once you have them.">
          <input
            className="input"
            value={form.rating}
            onChange={(e) => set('rating', Math.min(5, Math.max(0, Number(e.target.value))))}
            type="number"
            min="0"
            max="5"
            step="0.1"
            inputMode="decimal"
          />
        </Field>

        <div style={{ height: 6 }} />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : existing ? <>
            <Check size={18} /> Save changes
          </> : <>
            <Plus size={18} /> Publish shop
          </>}
        </button>
      </form>

      <div className="tab-space" />
    </div>
  )
}
