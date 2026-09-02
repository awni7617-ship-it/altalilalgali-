/**
 * Single place to rebrand the app. Change these and everything follows —
 * screen copy, the manifest name, the App Store display name.
 */
export const APP = {
  name: 'Rescue',
  tagline: 'Save food, save money',
  /** The product term for a bag of unsold food. */
  bagTerm: 'Surprise Bag',
  currency: 'USD',
  currencySymbol: '$',
  locale: 'en-US',
} as const

/**
 * Only this address can claim admin. Admin access is what reveals the "+"
 * button and every add / edit / delete control in the app.
 *
 * NOTE ON SECURITY: this is a client-side gate for a test build. It keeps the
 * admin tools out of the way of ordinary users on a device, and nothing more —
 * anyone who reads the bundle can see the check exists. Before the App Store,
 * move store writes behind a real server that verifies a signed-in admin.
 * See README "Before you ship".
 */
export const ADMIN_EMAIL = 'awni7617@gmail.com'

export const CATEGORIES = [
  { id: 'meals', label: 'Meals' },
  { id: 'bakery', label: 'Bread & pastries' },
  { id: 'groceries', label: 'Groceries' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'other', label: 'Other' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const categoryLabel = (id: string) =>
  CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
