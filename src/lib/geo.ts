import type { Coords } from './types'

const R = 6371 // km

const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in kilometres. */
export function distanceKm(a: Coords, b: Coords): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Compass bearing from `a` to `b`, in degrees clockwise from north. */
export function bearingDeg(a: Coords, b: Coords): number {
  const dLng = rad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(rad(b.lat))
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180) / Math.PI
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: 'denied' | 'unavailable' | 'unsupported' }

export function requestLocation(timeoutMs = 10_000): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ ok: false, reason: 'unsupported' })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, coords: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      (err) =>
        resolve({
          ok: false,
          reason: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}

export const locationMessage: Record<'denied' | 'unavailable' | 'unsupported', string> = {
  denied: 'Location is off for this app. Turn it on in your browser settings to sort by distance.',
  unavailable: 'Your location could not be found just now. Try again in a moment.',
  unsupported: 'This browser cannot share a location.',
}
