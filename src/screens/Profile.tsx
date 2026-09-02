import { useMemo, useState } from 'react'
import { APP } from '../config'
import { dayLabel, money, pickupWindow } from '../lib/format'
import type { Order } from '../lib/types'
import { useApp } from '../state/app'
import { Photo } from '../components/Photo'
import { Empty, Field, Sheet } from '../components/ui'
import { Cloud, Leaf, Lock, Pencil, Phone, Pin, User } from '../components/icons'

/** Widely used figure for the emissions avoided by rescuing one meal-sized bag. */
const KG_CO2E_PER_BAG = 2.5

interface Props {
  onOpenOrder: (order: Order) => void
  onAdmin: () => void
  onManage: () => void
  onLocate: () => void
  locating: boolean
}

export function Profile({ onOpenOrder, onAdmin, onManage, onLocate, locating }: Props) {
  const { orders, profile, setProfile, isAdmin, setAdmin, backend, coords, notify } = useApp()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.name ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')

  const impact = useMemo(() => {
    const done = orders.filter((o) => o.status === 'collected')
    const bags = done.reduce((n, o) => n + o.qty, 0)
    const saved = done.reduce((n, o) => n + Math.max(0, o.unitValue - o.unitPrice) * o.qty, 0)
    return { bags, saved, co2: bags * KG_CO2E_PER_BAG }
  }, [orders])

  const active = orders.filter((o) => o.status === 'active')
  const past = orders.filter((o) => o.status !== 'active')

  const saveProfile = () => {
    setProfile({ name: name.trim(), email: email.trim() })
    setEditing(false)
    notify('Profile saved.')
  }

  const orderRow = (o: Order) => (
    <button key={o.id} className="list-row" onClick={() => onOpenOrder(o)}>
      <span className="list-thumb" style={{ overflow: 'hidden', display: 'block' }}>
        <Photo id={o.coverId} alt="" />
      </span>
      <span className="list-lines">
        <span className="h3 truncate" style={{ display: 'block' }}>
          {o.storeName}
        </span>
        <span className="small" style={{ display: 'block', marginTop: 2 }}>
          {o.qty} {o.qty === 1 ? 'bag' : 'bags'} · {money(o.total)}
        </span>
        <span className="small mono" style={{ display: 'block', marginTop: 2 }}>
          {dayLabel(o.pickupDay)} {pickupWindow(o.pickupStart, o.pickupEnd)}
        </span>
      </span>
      <span
        className={`status-pill ${
          o.status === 'active'
            ? 'status-active'
            : o.status === 'collected'
              ? 'status-collected'
              : 'status-cancelled'
        }`}
      >
        {o.status === 'active' ? 'Reserved' : o.status === 'collected' ? 'Collected' : 'Cancelled'}
      </span>
    </button>
  )

  return (
    <div className="scroll">
      <header className="screen-head">
        <h1 className="h2 grow">You</h1>
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit profile">
          <Pencil size={17} />
        </button>
      </header>

      <div className="pad">
        <div className="panel">
          <div className="row">
            <span className="logo" style={{ width: 52, height: 52, fontSize: 19 }}>
              {profile?.name?.trim() ? profile.name.trim().charAt(0).toUpperCase() : <User size={22} />}
            </span>
            <div className="grow">
              <p className="h3">{profile?.name?.trim() || 'Add your name'}</p>
              <p className="small truncate" style={{ marginTop: 2 }}>
                {profile?.email?.trim() || 'Tap the pencil to set up your profile'}
              </p>
            </div>
          </div>
        </div>

        <section className="section" style={{ marginTop: 20 }}>
          <div className="section-head" style={{ paddingInline: 0 }}>
            <div>
              <h2 className="h2">Your impact</h2>
              <p className="section-sub">Counted once you collect a bag</p>
            </div>
          </div>
          <div className="panel">
            <div className="row-between">
              <div>
                <p className="price" style={{ fontSize: 26 }}>
                  {impact.bags}
                </p>
                <p className="small">bags rescued</p>
              </div>
              <div>
                <p className="price" style={{ fontSize: 26 }}>
                  {money(impact.saved)}
                </p>
                <p className="small">saved</p>
              </div>
              <div>
                <p className="price" style={{ fontSize: 26 }}>
                  {impact.co2.toFixed(1)}
                </p>
                <p className="small">kg CO₂e avoided</p>
              </div>
            </div>
            {impact.bags === 0 && (
              <p className="hint" style={{ marginTop: 12 }}>
                <Leaf size={13} /> Every bag you collect keeps about {KG_CO2E_PER_BAG} kg of CO₂e out
                of the air.
              </p>
            )}
          </div>
        </section>

        <section className="section">
          <div className="section-head" style={{ paddingInline: 0 }}>
            <h2 className="h2">Orders</h2>
          </div>
          {orders.length === 0 ? (
            <Empty
              title="No orders yet"
              body="When you reserve a bag it shows up here with the code you show at the counter."
            />
          ) : (
            <div className="stack-12">
              {active.length > 0 && (
                <>
                  <p className="eyebrow">Active</p>
                  {active.map(orderRow)}
                </>
              )}
              {past.length > 0 && (
                <>
                  <p className="eyebrow" style={{ marginTop: 6 }}>
                    Past
                  </p>
                  {past.map(orderRow)}
                </>
              )}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-head" style={{ paddingInline: 0 }}>
            <h2 className="h2">Settings</h2>
          </div>
          <div className="stack-8">
            <button className="list-row" onClick={onLocate} disabled={locating}>
              <span className="panel-icon">
                <Pin size={19} />
              </span>
              <span className="list-lines">
                <span className="h3" style={{ display: 'block' }}>
                  Location
                </span>
                <span className="small">
                  {locating ? 'Finding you…' : coords ? 'Shared — sorting by distance' : 'Not shared'}
                </span>
              </span>
            </button>

            <div className="list-row" style={{ cursor: 'default' }}>
              <span className="panel-icon">
                {backend === 'cloud' ? <Cloud size={19} /> : <Phone size={19} />}
              </span>
              <span className="list-lines">
                <span className="h3" style={{ display: 'block' }}>
                  {backend === 'cloud' ? 'Synced' : 'On this device'}
                </span>
                <span className="small">
                  {backend === 'cloud'
                    ? 'Shops you add are visible on your other devices.'
                    : 'Shops you add stay on this device only.'}
                </span>
              </span>
            </div>

            {isAdmin ? (
              <>
                <button className="list-row" onClick={onManage}>
                  <span className="panel-icon">
                    <Lock size={19} />
                  </span>
                  <span className="list-lines">
                    <span className="h3" style={{ display: 'block' }}>
                      Manage shops
                    </span>
                    <span className="small">Add, edit and remove shops</span>
                  </span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setAdmin(false)
                    notify('Signed out of admin.')
                  }}
                >
                  Sign out of admin
                </button>
              </>
            ) : (
              <button className="list-row" onClick={onAdmin}>
                <span className="panel-icon">
                  <Lock size={19} />
                </span>
                <span className="list-lines">
                  <span className="h3" style={{ display: 'block' }}>
                    Admin access
                  </span>
                  <span className="small">For the person who runs {APP.name}</span>
                </span>
              </button>
            )}
          </div>
        </section>
      </div>

      <div className="tab-space" />

      <Sheet open={editing} onClose={() => setEditing(false)} title="Your profile">
        <Field label="Name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </Field>
        <Field label="Email" hint="Used for your order receipts.">
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
          />
        </Field>
        <button className="btn btn-primary" onClick={saveProfile}>
          Save
        </button>
      </Sheet>
    </div>
  )
}
