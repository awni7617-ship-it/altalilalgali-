import { useMemo, useRef, useState } from 'react'
import { APP, CATEGORIES, type CategoryId } from '../config'
import { distanceKm } from '../lib/geo'
import type { Store } from '../lib/types'
import { useApp } from '../state/app'
import { StoreCard } from '../components/StoreCard'
import { Empty } from '../components/ui'
import { ChevronDown, Pin, Search } from '../components/icons'

interface Props {
  onOpenStore: (id: string) => void
  onChangeLocation: () => void
  onAddStore: () => void
}

export function Discover({ onOpenStore, onChangeLocation, onAddStore }: Props) {
  const { stores, favorites, coords, toggleFavorite, bagsLeftFor, isAdmin, ready } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryId | 'all'>('all')
  const [stuck, setStuck] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(() => {
    const list = [...stores]
    if (coords) {
      list.sort((a, b) => {
        const da = a.lat !== null && a.lng !== null ? distanceKm(coords, { lat: a.lat, lng: a.lng }) : Infinity
        const db = b.lat !== null && b.lng !== null ? distanceKm(coords, { lat: b.lat, lng: b.lng }) : Infinity
        return da - db
      })
    }
    return list
  }, [stores, coords])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sorted.filter((s) => {
      if (category !== 'all' && s.category !== category) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      )
    })
  }, [sorted, query, category])

  const almostGone = filtered.filter((s) => {
    const left = bagsLeftFor(s)
    return left > 0 && left <= 2
  })
  const fresh = filtered.filter((s) => Date.now() - s.createdAt < 14 * 864e5)
  const searching = query.trim().length > 0 || category !== 'all'

  const card = (s: Store, wide = false) => (
    <StoreCard
      key={s.id}
      store={s}
      wide={wide}
      left={bagsLeftFor(s)}
      isFavorite={favorites.includes(s.id)}
      coords={coords}
      onOpen={() => onOpenStore(s.id)}
      onToggleFavorite={() => toggleFavorite(s.id)}
    />
  )

  return (
    <div className="scroll" ref={scrollRef} onScroll={(e) => setStuck(e.currentTarget.scrollTop > 4)}>
      <header className={`topbar${stuck ? ' is-stuck' : ''}`}>
        <div className="topbar-row">
          <button className="locus" onClick={onChangeLocation}>
            <span className="panel-icon" style={{ width: 34, height: 34 }}>
              <Pin size={17} />
            </span>
            <span className="grow">
              <span className="locus-label">Near</span>
              <span className="locus-value">
                {coords ? 'Your location' : 'Set your location'}
                <ChevronDown size={15} />
              </span>
            </span>
          </button>
        </div>

        <div className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shops and bags"
            aria-label="Search shops and bags"
            enterKeyHint="search"
          />
        </div>

        <div className="chips">
          <button className="chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className="chip"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      {!ready ? (
        <div className="stack" style={{ paddingTop: 14 }}>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 236, borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      ) : stores.length === 0 ? (
        <Empty
          title={`No shops on ${APP.name} yet`}
          body={
            isAdmin
              ? 'Add your first shop and its Surprise Bag will show up right here.'
              : 'We are signing up shops near you. Check back soon — new bags appear here the moment they do.'
          }
          action={
            isAdmin ? (
              <button className="btn btn-primary btn-sm" onClick={onAddStore}>
                Add the first shop
              </button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <Empty
          title="Nothing matches that"
          body="Try a different word, or clear the filters to see everything nearby."
          action={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setQuery('')
                setCategory('all')
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : searching ? (
        <section className="section">
          <div className="section-head">
            <h2 className="h2">
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </h2>
          </div>
          <div className="stack">{filtered.map((s) => card(s, true))}</div>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <div>
                <h2 className="h2">Recommended for you</h2>
                <p className="section-sub">{coords ? 'Closest to you first' : 'Newest first'}</p>
              </div>
            </div>
            <div className="carousel">{filtered.map((s) => card(s))}</div>
          </section>

          {almostGone.length > 0 && (
            <section className="section">
              <div className="section-head">
                <div>
                  <h2 className="h2">Almost gone</h2>
                  <p className="section-sub">Two bags or fewer left</p>
                </div>
              </div>
              <div className="carousel">{almostGone.map((s) => card(s))}</div>
            </section>
          )}

          {fresh.length > 0 && fresh.length < filtered.length && (
            <section className="section">
              <div className="section-head">
                <div>
                  <h2 className="h2">New on {APP.name}</h2>
                  <p className="section-sub">Joined in the last two weeks</p>
                </div>
              </div>
              <div className="carousel">{fresh.map((s) => card(s))}</div>
            </section>
          )}

          <section className="section">
            <div className="section-head">
              <h2 className="h2">All shops nearby</h2>
            </div>
            <div className="stack">{filtered.map((s) => card(s, true))}</div>
          </section>
        </>
      )}

      <div className="tab-space" />
    </div>
  )
}
