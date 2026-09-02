import { useState } from 'react'
import { money } from '../lib/format'
import type { Store } from '../lib/types'
import { useApp } from '../state/app'
import { Photo } from '../components/Photo'
import { Empty, Sheet } from '../components/ui'
import { ChevronLeft, Pencil, Plus, Trash } from '../components/icons'

export function ManageStores({
  onBack,
  onAdd,
  onEdit,
}: {
  onBack: () => void
  onAdd: () => void
  onEdit: (store: Store) => void
}) {
  const { stores, deleteStore, bagsLeftFor, notify } = useApp()
  const [target, setTarget] = useState<Store | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (!target) return
    setBusy(true)
    try {
      await deleteStore(target)
      notify(`${target.name} was removed.`)
    } catch {
      notify('That shop could not be removed.', 'error')
    } finally {
      setBusy(false)
      setTarget(null)
    }
  }

  return (
    <div className="scroll">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <h1 className="h2 grow">Manage shops</h1>
        <button className="icon-btn" onClick={onAdd} aria-label="Add a shop">
          <Plus size={20} />
        </button>
      </header>

      {stores.length === 0 ? (
        <Empty
          title="No shops yet"
          body="Add a shop and it appears in the feed straight away."
          action={
            <button className="btn btn-primary btn-sm" onClick={onAdd}>
              Add a shop
            </button>
          }
        />
      ) : (
        <div className="stack-8 pad">
          {stores.map((s) => (
            <div className="list-row" key={s.id}>
              <span className="list-thumb" style={{ overflow: 'hidden', display: 'block' }}>
                <Photo id={s.photoIds[0]} alt="" />
              </span>
              <div className="list-lines">
                <p className="h3 truncate">{s.name}</p>
                <p className="small truncate" style={{ marginTop: 2 }}>
                  {money(s.price)} · {bagsLeftFor(s)} of {s.quantity} left
                </p>
                <p className="small truncate" style={{ marginTop: 2 }}>
                  {s.address || 'No address'}
                </p>
              </div>
              <div className="stack-8" style={{ flex: 'none' }}>
                <button className="icon-btn" onClick={() => onEdit(s)} aria-label={`Edit ${s.name}`}>
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setTarget(s)}
                  aria-label={`Delete ${s.name}`}
                  style={{ color: 'var(--hot)' }}
                >
                  <Trash size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="tab-space" />

      <Sheet open={Boolean(target)} onClose={() => setTarget(null)} title={`Delete ${target?.name}?`}>
        <p className="body" style={{ marginBottom: 18 }}>
          This removes the shop and its photos for everyone. Reservations people already hold are
          not cancelled.
        </p>
        <div className="stack-8">
          <button className="btn btn-danger" onClick={remove} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete shop'}
          </button>
          <button className="btn btn-secondary" onClick={() => setTarget(null)}>
            Keep it
          </button>
        </div>
      </Sheet>
    </div>
  )
}
