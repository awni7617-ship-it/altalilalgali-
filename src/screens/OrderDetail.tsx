import { useState } from 'react'
import { dayLabel, money, pickupWindow, relativeTime } from '../lib/format'
import type { Order } from '../lib/types'
import { useApp } from '../state/app'
import { Photo } from '../components/Photo'
import { Sheet } from '../components/ui'
import { Check, ChevronLeft, Clock, Pin } from '../components/icons'

export function OrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  const { cancelOrder, markCollected, notify } = useApp()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>, message: string) => {
    setBusy(true)
    try {
      await fn()
      notify(message)
    } catch {
      notify('That did not go through. Try again.', 'error')
    } finally {
      setBusy(false)
      setConfirmCancel(false)
    }
  }

  const status =
    order.status === 'active'
      ? { label: 'Reserved', cls: 'status-pill status-active' }
      : order.status === 'collected'
        ? { label: 'Collected', cls: 'status-pill status-collected' }
        : { label: 'Cancelled', cls: 'status-pill status-cancelled' }

  return (
    <div className="scroll">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <h1 className="h2 grow">Your order</h1>
        <span className={status.cls}>{status.label}</span>
      </header>

      <div className="pad">
        <div className="ticket">
          <div className="ticket-top">
            <span style={{ width: 54, height: 54, borderRadius: 'var(--r-sm)', overflow: 'hidden', flex: 'none' }}>
              <Photo id={order.coverId} alt="" />
            </span>
            <div className="grow">
              <p className="h3">{order.storeName}</p>
              <p className="small" style={{ marginTop: 2 }}>
                {order.qty} {order.qty === 1 ? 'bag' : 'bags'} · {money(order.total)}
              </p>
            </div>
          </div>

          <div className="ticket-tear" />

          <div className="ticket-code">
            <p className="eyebrow">Show this at the counter</p>
            <strong>{order.code}</strong>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-row">
            <span className="panel-icon">
              <Clock size={19} />
            </span>
            <div className="grow">
              <p className="h3">Collect {dayLabel(order.pickupDay).toLowerCase()}</p>
              <p className="small mono" style={{ marginTop: 2 }}>
                {pickupWindow(order.pickupStart, order.pickupEnd)}
              </p>
            </div>
          </div>
          {order.address && (
            <div className="panel-row">
              <span className="panel-icon">
                <Pin size={19} />
              </span>
              <div className="grow">
                <p className="h3">Pick-up point</p>
                <p className="small" style={{ marginTop: 2 }}>
                  {order.address}
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="hint center" style={{ margin: '14px 0 0' }}>
          Reserved {relativeTime(order.createdAt)}
        </p>

        {order.status === 'active' && (
          <div className="stack-8" style={{ marginTop: 20 }}>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => run(() => markCollected(order), 'Marked as collected. Enjoy it.')}
            >
              <Check size={18} /> I collected this
            </button>
            <button className="btn btn-secondary" onClick={() => setConfirmCancel(true)} disabled={busy}>
              Cancel reservation
            </button>
          </div>
        )}
      </div>

      <div className="tab-space" />

      <Sheet open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel this reservation?">
        <p className="body" style={{ marginBottom: 18 }}>
          The bag goes back on sale for someone else. You can always reserve another.
        </p>
        <div className="stack-8">
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => run(() => cancelOrder(order), 'Reservation cancelled.')}
          >
            Cancel reservation
          </button>
          <button className="btn btn-secondary" onClick={() => setConfirmCancel(false)}>
            Keep it
          </button>
        </div>
      </Sheet>
    </div>
  )
}
