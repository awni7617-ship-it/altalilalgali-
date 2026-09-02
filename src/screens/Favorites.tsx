import { useApp } from '../state/app'
import { StoreCard } from '../components/StoreCard'
import { Empty } from '../components/ui'

export function Favorites({ onOpenStore }: { onOpenStore: (id: string) => void }) {
  const { stores, favorites, coords, toggleFavorite, bagsLeftFor } = useApp()
  const saved = stores.filter((s) => favorites.includes(s.id))

  return (
    <div className="scroll">
      <header className="screen-head">
        <h1 className="h2 grow">Favourites</h1>
      </header>

      {saved.length === 0 ? (
        <Empty
          title="No favourites yet"
          body="Tap the heart on any shop and it will wait for you here, so you can check its bags first."
        />
      ) : (
        <div className="stack">
          {saved.map((s) => (
            <StoreCard
              key={s.id}
              store={s}
              wide
              left={bagsLeftFor(s)}
              isFavorite
              coords={coords}
              onOpen={() => onOpenStore(s.id)}
              onToggleFavorite={() => toggleFavorite(s.id)}
            />
          ))}
        </div>
      )}

      <div className="tab-space" />
    </div>
  )
}
