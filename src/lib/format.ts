import { APP } from '../config'
import type { PickupDay } from './types'

export const money = (n: number) =>
  new Intl.NumberFormat(APP.locale, {
    style: 'currency',
    currency: APP.currency,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n)

/** "18:00" -> "6:00 PM" in the app locale, or the raw value if it is malformed. */
export function clockTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return new Intl.DateTimeFormat(APP.locale, { hour: 'numeric', minute: '2-digit' }).format(d)
}

export const pickupWindow = (start: string, end: string) => `${clockTime(start)} - ${clockTime(end)}`

export const dayLabel = (day: PickupDay) => (day === 'today' ? 'Today' : 'Tomorrow')

/** "Collect today 6:00 PM - 8:00 PM" */
export const collectLine = (day: PickupDay, start: string, end: string) =>
  `Collect ${day} ${pickupWindow(start, end)}`

export function discountPercent(price: number, original: number): number {
  if (original <= 0 || price >= original) return 0
  return Math.round((1 - price / original) * 100)
}

/** A six-character code the shopper shows at the counter. Avoids look-alikes. */
export function orderCode(): string {
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY3479'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function relativeTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/** Minutes from now until a pickup window closes; negative once it has passed. */
export function minutesUntilClose(day: PickupDay, end: string): number {
  const [h, m] = end.split(':').map(Number)
  const close = new Date()
  if (day === 'tomorrow') close.setDate(close.getDate() + 1)
  close.setHours(h || 0, m || 0, 0, 0)
  return Math.round((close.getTime() - Date.now()) / 60_000)
}
