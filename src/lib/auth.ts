/**
 * Admin access.
 *
 * The first time the configured admin address is entered, it claims the device
 * and sets a passcode. After that the passcode unlocks the admin tools: the "+"
 * button, editing and deleting.
 *
 * The passcode is stored as a salted SHA-256 digest, so it is not sitting in
 * plain text on the device. That is the honest limit of what a client-only app
 * can do — a determined person with the device can still reach the data. Real
 * protection means a server that verifies the admin before accepting a write.
 * See README "Before you ship".
 */
import { ADMIN_EMAIL } from '../config'
import { idb, safeGet } from './idb'

interface AdminRecord {
  email: string
  salt: string
  hash: string
}

const KEY = 'admin'
const SESSION_KEY = 'rescue.admin.session'

const subtle = () => globalThis.crypto?.subtle

/** Admin setup needs Web Crypto, which browsers only expose on a secure origin. */
export const canUseAdmin = () => Boolean(subtle())

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

async function digest(passcode: string, salt: string): Promise<string> {
  const s = subtle()
  if (!s) throw new Error('Admin access needs a secure (https) connection.')
  const bytes = new TextEncoder().encode(`${salt}:${passcode}`)
  return toHex(await s.digest('SHA-256', bytes))
}

export const loadAdminRecord = () => safeGet<AdminRecord | null>(KEY, null)

export const isAdminEmail = (email: string) =>
  email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()

/** True once an admin passcode exists on this device. */
export async function adminIsClaimed(): Promise<boolean> {
  return (await loadAdminRecord()) !== null
}

export async function claimAdmin(email: string, passcode: string): Promise<void> {
  if (!isAdminEmail(email)) throw new Error('That address is not the admin account for this app.')
  if (passcode.length < 4) throw new Error('Use at least 4 characters for the passcode.')
  if (await adminIsClaimed()) throw new Error('Admin access is already set up on this device.')
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  await idb.set(KEY, { email: email.trim().toLowerCase(), salt, hash: await digest(passcode, salt) })
}

export async function verifyAdmin(email: string, passcode: string): Promise<boolean> {
  const rec = await loadAdminRecord()
  if (!rec) return false
  if (email.trim().toLowerCase() !== rec.email) return false
  return (await digest(passcode, rec.salt)) === rec.hash
}

export async function changePasscode(current: string, next: string): Promise<void> {
  const rec = await loadAdminRecord()
  if (!rec) throw new Error('Admin access is not set up on this device.')
  if ((await digest(current, rec.salt)) !== rec.hash) throw new Error('That passcode is not right.')
  if (next.length < 4) throw new Error('Use at least 4 characters for the passcode.')
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  await idb.set(KEY, { ...rec, salt, hash: await digest(next, salt) })
}

/** Session flag only — the passcode itself is never kept around. */
export function readSession(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSession(on: boolean): void {
  try {
    if (on) localStorage.setItem(SESSION_KEY, '1')
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* private mode — the session simply does not persist */
  }
}
