import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addReservation,
  backendKind,
  bagsLeft,
  deleteStore as repoDeleteStore,
  initRepo,
  listStores,
  onReservations,
  onStores,
  removeReservation,
  saveStore as repoSaveStore,
  type BackendKind,
  type Reservation,
} from '../lib/repo'
import { orderCode } from '../lib/format'
import { readSession, writeSession } from '../lib/auth'
import * as personal from '../lib/storage'
import type { Coords, Order, Profile, Store } from '../lib/types'

export interface Toast {
  id: number
  message: string
  tone: 'ok' | 'error'
}

interface AppValue {
  ready: boolean
  backend: BackendKind
  stores: Store[]
  reservations: Reservation[]
  orders: Order[]
  favorites: string[]
  profile: Profile | null
  coords: Coords | null
  isAdmin: boolean
  toasts: Toast[]

  bagsLeftFor: (store: Store) => number
  refresh: () => Promise<void>
  saveStore: (store: Store) => Promise<void>
  deleteStore: (store: Store) => Promise<void>
  toggleFavorite: (id: string) => void
  reserve: (store: Store, qty: number) => Promise<Order>
  cancelOrder: (order: Order) => Promise<void>
  markCollected: (order: Order) => Promise<void>
  setCoords: (c: Coords | null) => void
  setProfile: (p: Profile) => void
  setAdmin: (on: boolean) => void
  notify: (message: string, tone?: 'ok' | 'error') => void
}

const Ctx = createContext<AppValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [backend, setBackend] = useState<BackendKind>('device')
  const [stores, setStores] = useState<Store[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [profile, setProfileState] = useState<Profile | null>(null)
  const [coords, setCoordsState] = useState<Coords | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  const notify = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])

  // Boot: resolve the backend, then load everything in parallel and subscribe.
  useEffect(() => {
    let unsubStores = () => {}
    let unsubRes = () => {}
    let alive = true

    void (async () => {
      await initRepo()
      if (!alive) return
      setBackend(backendKind())

      const [o, f, p, c] = await Promise.all([
        personal.loadOrders(),
        personal.loadFavorites(),
        personal.loadProfile(),
        personal.loadCoords(),
      ])
      if (!alive) return
      setOrders(o)
      setFavorites(f)
      setProfileState(p)
      setCoordsState(c)
      setIsAdmin(readSession())

      unsubStores = onStores((s) => alive && setStores(s))
      unsubRes = onReservations((r) => alive && setReservations(r))
      setReady(true)
    })()

    return () => {
      alive = false
      unsubStores()
      unsubRes()
    }
  }, [])

  const refresh = useCallback(async () => {
    setStores(await listStores())
  }, [])

  const bagsLeftFor = useCallback(
    (store: Store) => bagsLeft(store, reservations),
    [reservations],
  )

  const saveStore = useCallback(
    async (store: Store) => {
      await repoSaveStore(store)
      await refresh()
    },
    [refresh],
  )

  const deleteStore = useCallback(
    async (store: Store) => {
      const media = [...store.photoIds, ...(store.logoId ? [store.logoId] : [])]
      await repoDeleteStore(store.id, media)
      setStores((prev) => prev.filter((s) => s.id !== store.id))
      await refresh()
    },
    [refresh],
  )

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
      void personal.saveFavorites(next)
      return next
    })
  }, [])

  const reserve = useCallback(
    async (store: Store, qty: number) => {
      const order: Order = {
        id: crypto.randomUUID(),
        storeId: store.id,
        storeName: store.name,
        coverId: store.photoIds[0] ?? null,
        address: store.address,
        qty,
        unitPrice: store.price,
        unitValue: store.originalValue,
        total: +(store.price * qty).toFixed(2),
        code: orderCode(),
        pickupDay: store.pickupDay,
        pickupStart: store.pickupStart,
        pickupEnd: store.pickupEnd,
        status: 'active',
        createdAt: Date.now(),
      }
      await addReservation({ id: order.id, storeId: store.id, qty, createdAt: order.createdAt })
      setReservations((prev) => [...prev, { id: order.id, storeId: store.id, qty, createdAt: order.createdAt }])
      setOrders((prev) => {
        const next = [order, ...prev]
        void personal.saveOrders(next)
        return next
      })
      return order
    },
    [],
  )

  const updateOrder = useCallback((order: Order, status: Order['status']) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === order.id ? { ...o, status } : o))
      void personal.saveOrders(next)
      return next
    })
  }, [])

  const cancelOrder = useCallback(
    async (order: Order) => {
      await removeReservation(order.id)
      setReservations((prev) => prev.filter((r) => r.id !== order.id))
      updateOrder(order, 'cancelled')
    },
    [updateOrder],
  )

  const markCollected = useCallback(
    async (order: Order) => {
      // The bag has left the shop, so the hold is no longer inventory.
      await removeReservation(order.id)
      setReservations((prev) => prev.filter((r) => r.id !== order.id))
      updateOrder(order, 'collected')
    },
    [updateOrder],
  )

  const setCoords = useCallback((c: Coords | null) => {
    setCoordsState(c)
    void personal.saveCoords(c)
  }, [])

  const setProfile = useCallback((p: Profile) => {
    setProfileState(p)
    void personal.saveProfile(p)
  }, [])

  const setAdmin = useCallback((on: boolean) => {
    setIsAdmin(on)
    writeSession(on)
  }, [])

  const value = useMemo<AppValue>(
    () => ({
      ready,
      backend,
      stores,
      reservations,
      orders,
      favorites,
      profile,
      coords,
      isAdmin,
      toasts,
      bagsLeftFor,
      refresh,
      saveStore,
      deleteStore,
      toggleFavorite,
      reserve,
      cancelOrder,
      markCollected,
      setCoords,
      setProfile,
      setAdmin,
      notify,
    }),
    [
      ready, backend, stores, reservations, orders, favorites, profile, coords, isAdmin, toasts,
      bagsLeftFor, refresh, saveStore, deleteStore, toggleFavorite, reserve, cancelOrder,
      markCollected, setCoords, setProfile, setAdmin, notify,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}
