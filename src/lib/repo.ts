/**
 * The store catalogue, behind one interface with two backends.
 *
 *  - "cloud"  — the artifact `db` capability. Restaurants you add on your phone
 *               show up on your laptop. Used automatically when the page runs
 *               inside claude.ai.
 *  - "device" — IndexedDB. Used by `npm run dev` and by the packaged iOS build,
 *               where no claude.ai runtime exists.
 *
 * Personal data (orders, favourites, profile, admin credential) is always on
 * the device — see storage.ts. Only the catalogue is shared.
 *
 * Inventory note: `store.quantity` is how many bags the shop put out, and it is
 * only ever written by an admin. What a shopper reserves goes into a separate
 * `reservations` collection, and "bags left" is computed from the two. That way
 * a shopper never writes to the catalogue, which is what lets the publish rules
 * keep catalogue writes admin-only.
 */

import { idb } from './idb'
import type { Store } from './types'

export interface Reservation {
  id: string
  storeId: string
  qty: number
  createdAt: number
}

export type BackendKind = 'cloud' | 'device'

/** Minimal shape of the claude.ai runtime bridge; absent everywhere else. */
type ClaudeBridge = { use: (name: string) => Promise<unknown> }
type Snap = { id: string; data(): Record<string, unknown> | undefined; exists: boolean }
type QSnap = { docs: Snap[] }
type DocRef = {
  get(): Promise<Snap>
  set(d: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  collection(p: string): CollRef
}
type CollRef = {
  doc(id?: string): DocRef
  get(): Promise<QSnap>
  onSnapshot(next: (s: QSnap) => void, error?: (e: unknown) => void): () => void
}
type CloudDb = { doc(p: string): DocRef; collection(p: string): CollRef }

const CHUNK = 180_000

let cloud: CloudDb | null = null
let ready: Promise<void> | null = null

/** Resolve the backend once. Never rejects — absence is the normal case. */
export function initRepo(): Promise<void> {
  if (ready) return ready
  ready = (async () => {
    const bridge = (globalThis as { claude?: ClaudeBridge }).claude
    if (!bridge?.use) return
    try {
      cloud = ((await bridge.use('db')) as CloudDb | null) ?? null
    } catch {
      cloud = null
    }
  })()
  return ready
}

export const backendKind = (): BackendKind => (cloud ? 'cloud' : 'device')

/* ------------------------------------------------------------------ media */

const mediaCache = new Map<string, string>()

export async function putMedia(dataUri: string): Promise<string> {
  const id = crypto.randomUUID()
  mediaCache.set(id, dataUri)
  if (cloud) {
    const parts: string[] = []
    for (let i = 0; i < dataUri.length; i += CHUNK) parts.push(dataUri.slice(i, i + CHUNK))
    await Promise.all(
      parts.map((s, i) => cloud!.doc(`media/${id}`).collection('chunks').doc(String(i)).set({ s })),
    )
    await cloud.doc(`media/${id}`).set({ chunks: parts.length })
  } else {
    await idb.set(`media:${id}`, dataUri)
  }
  return id
}

export async function getMedia(id: string): Promise<string | null> {
  const hit = mediaCache.get(id)
  if (hit) return hit
  let value: string | null = null
  if (cloud) {
    const head = await cloud.doc(`media/${id}`).get()
    const count = Number(head.data()?.chunks ?? 0)
    if (count > 0) {
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          cloud!.doc(`media/${id}`).collection('chunks').doc(String(i)).get(),
        ),
      )
      value = chunks.map((c) => String(c.data()?.s ?? '')).join('')
    }
  } else {
    value = (await idb.get<string>(`media:${id}`)) ?? null
  }
  if (value) mediaCache.set(id, value)
  return value
}

export async function deleteMedia(id: string): Promise<void> {
  mediaCache.delete(id)
  if (cloud) {
    const head = await cloud.doc(`media/${id}`).get()
    const count = Number(head.data()?.chunks ?? 0)
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        cloud!.doc(`media/${id}`).collection('chunks').doc(String(i)).delete(),
      ),
    )
    await cloud.doc(`media/${id}`).delete()
  } else {
    await idb.del(`media:${id}`)
  }
}

/* ----------------------------------------------------------------- stores */

const asStore = (s: Snap): Store => ({ ...(s.data() as unknown as Store), id: s.id })
const byNewest = (a: Store, b: Store) => b.createdAt - a.createdAt

export async function listStores(): Promise<Store[]> {
  if (cloud) return (await cloud.collection('stores').get()).docs.map(asStore).sort(byNewest)
  return ((await idb.get<Store[]>('stores')) ?? []).sort(byNewest)
}

/** Live catalogue. On the device backend there is nothing to push, so the
 *  callback fires once and changes arrive through explicit reloads. */
export function onStores(next: (stores: Store[]) => void): () => void {
  if (cloud) {
    return cloud.collection('stores').onSnapshot(
      (snap) => next(snap.docs.map(asStore).sort(byNewest)),
      () => void 0,
    )
  }
  void listStores().then(next)
  return () => void 0
}

export async function saveStore(store: Store): Promise<void> {
  const record = { ...store, updatedAt: Date.now() }
  if (cloud) {
    const { id: _id, ...body } = record
    await cloud.doc(`stores/${store.id}`).set(body as unknown as Record<string, unknown>)
  } else {
    const all = (await idb.get<Store[]>('stores')) ?? []
    const i = all.findIndex((s) => s.id === store.id)
    if (i >= 0) all[i] = record
    else all.push(record)
    await idb.set('stores', all)
  }
}

export async function deleteStore(id: string, mediaIds: string[]): Promise<void> {
  await Promise.all(mediaIds.map((m) => deleteMedia(m).catch(() => undefined)))
  if (cloud) {
    await cloud.doc(`stores/${id}`).delete()
  } else {
    const all = (await idb.get<Store[]>('stores')) ?? []
    await idb.set(
      'stores',
      all.filter((s) => s.id !== id),
    )
  }
}

/* ----------------------------------------------------------- reservations */

const asReservation = (s: Snap): Reservation => ({ ...(s.data() as unknown as Reservation), id: s.id })

export function onReservations(next: (rs: Reservation[]) => void): () => void {
  if (cloud) {
    return cloud.collection('reservations').onSnapshot(
      (snap) => next(snap.docs.map(asReservation)),
      () => void 0,
    )
  }
  void idb.get<Reservation[]>('reservations').then((r) => next(r ?? []))
  return () => void 0
}

export async function addReservation(r: Reservation): Promise<void> {
  if (cloud) {
    const { id: _id, ...body } = r
    await cloud.doc(`reservations/${r.id}`).set(body as unknown as Record<string, unknown>)
  } else {
    const all = (await idb.get<Reservation[]>('reservations')) ?? []
    all.push(r)
    await idb.set('reservations', all)
  }
}

export async function removeReservation(id: string): Promise<void> {
  if (cloud) {
    await cloud.doc(`reservations/${id}`).delete()
  } else {
    const all = (await idb.get<Reservation[]>('reservations')) ?? []
    await idb.set(
      'reservations',
      all.filter((r) => r.id !== id),
    )
  }
}

/** Bags still available: what the shop put out, minus what shoppers hold. */
export function bagsLeft(store: Store, reservations: Reservation[]): number {
  const held = reservations
    .filter((r) => r.storeId === store.id)
    .reduce((sum, r) => sum + r.qty, 0)
  return Math.max(0, store.quantity - held)
}
