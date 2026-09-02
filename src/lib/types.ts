import type { CategoryId } from '../config'

export type PickupDay = 'today' | 'tomorrow'

export interface Store {
  id: string
  name: string
  category: CategoryId
  /** What the shop is, in the shop's own words. Shown on the detail screen. */
  description: string
  /** Ids into the media store. photoIds[0] is the cover. */
  photoIds: string[]
  logoId: string | null
  address: string
  lat: number | null
  lng: number | null
  price: number
  originalValue: number
  quantity: number
  pickupDay: PickupDay
  /** "HH:MM", 24h. */
  pickupStart: string
  pickupEnd: string
  rating: number
  ratingCount: number
  bagTitle: string
  /** Free text: "Could contain bread, pastries and sandwiches." */
  whatYouGet: string
  createdAt: number
  updatedAt: number
}

export type OrderStatus = 'active' | 'collected' | 'cancelled'

export interface Order {
  id: string
  storeId: string
  storeName: string
  coverId: string | null
  address: string
  qty: number
  unitPrice: number
  /** The shop's stated everyday value, kept so impact totals survive price edits. */
  unitValue: number
  total: number
  /** Six characters, shown to the shop at the counter. */
  code: string
  pickupDay: PickupDay
  pickupStart: string
  pickupEnd: string
  status: OrderStatus
  createdAt: number
}

export interface Profile {
  name: string
  email: string
}

/** A resolved position for distance sorting, or null if the user declined. */
export interface Coords {
  lat: number
  lng: number
}

export const emptyStore = (): Store => ({
  id: crypto.randomUUID(),
  name: '',
  category: 'meals',
  description: '',
  photoIds: [],
  logoId: null,
  address: '',
  lat: null,
  lng: null,
  price: 4.99,
  originalValue: 15,
  quantity: 3,
  pickupDay: 'today',
  pickupStart: '18:00',
  pickupEnd: '20:00',
  rating: 4.6,
  ratingCount: 0,
  bagTitle: 'Surprise Bag',
  whatYouGet: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
