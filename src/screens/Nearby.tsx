import { useMemo, useState } from 'react'
import { useApp } from '../state/app'
import { ProximityMap } from '../components/ProximityMap'
import { StoreCard } from '../components/StoreCard'
import { Empty } from '../components/ui'
import { Crosshair } from '../components/icons'
import { distanceKm } from '../lib/geo'

export function Nearby({
  onOpenStore,
  onLocate,
  locating,
}: {
  onOpenStore: (id: string) => void
  onLocate: () => void
  locating: boolean
}) {
  const { stores, coords, favorites, toggleFavorite, bagsLeftFor } = useApp()
  const [selected, setSelected] = useState<string | null>(null)

  const located = useMemo(() => stores.filter((s) => s.lat !== null && s.lng !== null), [stores])

  const ordered = useMemo(() => {
    if (!coords) return located
    return [...located].sort(
      (a, b) =>
        distanceKm(coords, { lat: a.lat!, lng: a.lng! }) -
        distanceKm(coords, { lat: b.lat!, lng: b.lng! }),
    )
  }, [located, coords])

  const chosen = ordered.find((s) => s.id === selected) ?? null

  return (
    <div className="scroll">
      <header className="screen-head">
        <h1 className="h2 grow">Nearby</h1>
        <button
          className="icon-btn"
          onClick={onLocate}
          aria-label="Find my location"
          disabled={locating}
        >
          <Crosshair size={18} />
        </button>
      </header>

      {located.length === 0 ? (
        <Empty
          title="Nothing to map yet"
          body="Shops show up here once they have been added with a location."
        />
      ) : (
        <>
          <ProximityMap
            stores={ordered}
            center={coords}
            selectedId={selected}
            onSelect={(id) => setSelected(id === selected ? null : id)}
          />

          {!coords && (
            <p className="small pad" style={{ marginTop: 10 }}>
              Turn on location to place yourself at the centre and sort by distance.
            </p>
          )}

          <section className="section" style={{ marginTop: 18 }}>
            <div className="section-head">
              <h2 className="h2">{chosen ? 'Selected' : `${ordered.length} nearby`}</h2>
              {chosen && (
                <button className="btn-ghost" onClick={() => setSelected(null)} style={{ fontSize: 14 }}>
                  Show all
                </button>
              )}
            </div>
            <div className="stack">
              {(chosen ? [chosen] : ordered).map((s) => (
                <StoreCard
                  key={s.id}
                  store={s}
                  wide
                  left={bagsLeftFor(s)}
                  isFavorite={favorites.includes(s.id)}
                  coords={coords}
                  onOpen={() => onOpenStore(s.id)}
                  onToggleFavorite={() => toggleFavorite(s.id)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <div className="tab-space" />
    </div>
  )
}
