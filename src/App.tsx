import { useCallback, useEffect, useState } from 'react'
import { APP } from './config'
import { locationMessage, requestLocation } from './lib/geo'
import type { Order, Store } from './lib/types'
import { useApp } from './state/app'
import { Discover } from './screens/Discover'
import { Nearby } from './screens/Nearby'
import { Favorites } from './screens/Favorites'
import { Profile } from './screens/Profile'
import { StoreDetail } from './screens/StoreDetail'
import { OrderDetail } from './screens/OrderDetail'
import { AdminUnlock } from './screens/AdminUnlock'
import { StoreForm } from './screens/StoreForm'
import { ManageStores } from './screens/ManageStores'
import { Sheet, Toasts } from './components/ui'
import { Heart, Home, MapIcon, Pin, Plus, User } from './components/icons'

type Tab = 'discover' | 'nearby' | 'favorites' | 'profile'

type Route =
  | { name: 'tabs' }
  | { name: 'store'; id: string }
  | { name: 'order'; id: string }
  | { name: 'admin' }
  | { name: 'form'; storeId: string | null }
  | { name: 'manage' }

const TABS: ReadonlyArray<{ id: Tab; label: string; Icon: typeof Home }> = [
  { id: 'discover', label: 'Discover', Icon: Home },
  { id: 'nearby', label: 'Nearby', Icon: MapIcon },
  { id: 'favorites', label: 'Favourites', Icon: Heart },
  { id: 'profile', label: 'You', Icon: User },
]

export default function App() {
  const { stores, orders, coords, setCoords, isAdmin, notify } = useApp()
  const [tab, setTab] = useState<Tab>('discover')
  const [stack, setStack] = useState<Route[]>([{ name: 'tabs' }])
  const [askLocation, setAskLocation] = useState(false)
  const [locating, setLocating] = useState(false)

  const route = stack[stack.length - 1]
  const atRoot = stack.length === 1

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), [])
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), [])

  // Let the phone's back gesture and the browser back button pop the stack.
  useEffect(() => {
    const onPop = () => pop()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [pop])

  useEffect(() => {
    if (!atRoot) window.history.pushState({ depth: stack.length }, '')
    // Only push when the stack grows; popping is driven by popstate itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack.length])

  const locate = useCallback(async () => {
    setLocating(true)
    const result = await requestLocation()
    setLocating(false)
    setAskLocation(false)
    if (result.ok) {
      setCoords(result.coords)
      notify('Location set. Sorting by distance.')
    } else {
      notify(locationMessage[result.reason], 'error')
    }
  }, [notify, setCoords])

  const openStore = (id: string) => push({ name: 'store', id })
  const activeOrders = orders.filter((o) => o.status === 'active').length

  const currentStore = route.name === 'store' ? stores.find((s) => s.id === route.id) : undefined
  const formStore =
    route.name === 'form' && route.storeId ? (stores.find((s) => s.id === route.storeId) ?? null) : null

  const showTabs = route.name === 'tabs'
  const showFab = isAdmin && showTabs && (tab === 'discover' || tab === 'nearby')

  return (
    <div className="shell">
      {route.name === 'tabs' && tab === 'discover' && (
        <Discover
          onOpenStore={openStore}
          onChangeLocation={() => setAskLocation(true)}
          onAddStore={() => push({ name: 'form', storeId: null })}
        />
      )}

      {route.name === 'tabs' && tab === 'nearby' && (
        <Nearby onOpenStore={openStore} onLocate={locate} locating={locating} />
      )}

      {route.name === 'tabs' && tab === 'favorites' && <Favorites onOpenStore={openStore} />}

      {route.name === 'tabs' && tab === 'profile' && (
        <Profile
          onOpenOrder={(o: Order) => push({ name: 'order', id: o.id })}
          onAdmin={() => push({ name: 'admin' })}
          onManage={() => push({ name: 'manage' })}
          onLocate={locate}
          locating={locating}
        />
      )}

      {route.name === 'store' &&
        (currentStore ? (
          <StoreDetail
            store={currentStore}
            onBack={pop}
            onReserved={(o) => setStack([{ name: 'tabs' }, { name: 'order', id: o.id }])}
            onEdit={() => push({ name: 'form', storeId: currentStore.id })}
          />
        ) : (
          <Gone onBack={pop} what="shop" />
        ))}

      {route.name === 'order' &&
        (() => {
          const order = orders.find((o) => o.id === route.id)
          return order ? <OrderDetail order={order} onBack={pop} /> : <Gone onBack={pop} what="order" />
        })()}

      {route.name === 'admin' && <AdminUnlock onBack={pop} onUnlocked={pop} />}

      {route.name === 'manage' && (
        <ManageStores
          onBack={pop}
          onAdd={() => push({ name: 'form', storeId: null })}
          onEdit={(s: Store) => push({ name: 'form', storeId: s.id })}
        />
      )}

      {route.name === 'form' && (
        <StoreForm existing={formStore} onBack={pop} onSaved={() => pop()} />
      )}

      {showFab && (
        <button className="fab" onClick={() => push({ name: 'form', storeId: null })}>
          <Plus size={20} />
          Add shop
        </button>
      )}

      {showTabs && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className="tab"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={21} fill={tab === id} />
              {label}
              {id === 'profile' && activeOrders > 0 && <span className="tab-dot">{activeOrders}</span>}
            </button>
          ))}
        </nav>
      )}

      <Toasts />

      <Sheet open={askLocation} onClose={() => setAskLocation(false)} title="Your location">
        <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span className="panel-icon">
            <Pin size={19} />
          </span>
          <p className="body" style={{ margin: 0 }}>
            {APP.name} uses your location to show the closest shops first and to work out how far
            each one is. It is only ever kept on this device.
          </p>
        </div>
        <div className="stack-8" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={locate} disabled={locating}>
            {locating ? 'Finding you…' : coords ? 'Update my location' : 'Use my location'}
          </button>
          {coords && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setCoords(null)
                setAskLocation(false)
                notify('Location cleared.')
              }}
            >
              Stop using my location
            </button>
          )}
        </div>
      </Sheet>
    </div>
  )
}

function Gone({ onBack, what }: { onBack: () => void; what: string }) {
  return (
    <div className="scroll">
      <div className="empty" style={{ paddingTop: 90 }}>
        <h2>That {what} is no longer here</h2>
        <p>It may have been removed. Head back and pick another.</p>
        <button className="btn btn-primary btn-sm" onClick={onBack}>
          Go back
        </button>
      </div>
    </div>
  )
}
