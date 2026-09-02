/** Per-device data: orders, favourites, profile. Never shared. */
import { idb, safeGet } from './idb'
import type { Coords, Order, Profile } from './types'

export const loadOrders = () => safeGet<Order[]>('orders', [])
export const saveOrders = (o: Order[]) => idb.set('orders', o)

export const loadFavorites = () => safeGet<string[]>('favorites', [])
export const saveFavorites = (f: string[]) => idb.set('favorites', f)

export const loadProfile = () => safeGet<Profile | null>('profile', null)
export const saveProfile = (p: Profile) => idb.set('profile', p)

export const loadCoords = () => safeGet<Coords | null>('coords', null)
export const saveCoords = (c: Coords | null) => idb.set('coords', c)

export const clearEverything = () => idb.clear()
