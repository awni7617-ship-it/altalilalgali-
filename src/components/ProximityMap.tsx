import { useMemo } from 'react'
import { bearingDeg, distanceKm, formatDistance } from '../lib/geo'
import type { Coords, Store } from '../lib/types'

/**
 * A proximity map: you at the centre, each shop placed at its true compass
 * bearing and scaled distance, with rings for scale.
 *
 * This deliberately is not a street map. Street tiles have to be fetched from a
 * tile server, which the claude.ai preview blocks, so a tile map would render as
 * a grey box during testing. The packaged iOS build has no such restriction —
 * see README "Swapping in a street map" for the drop-in.
 *
 * Colours go through `style`, not presentation attributes: `fill="var(--x)"` is
 * not resolved reliably across browsers, and the map has to theme with the app.
 */

const SIZE = 300
const C = SIZE / 2
const R_MAX = 116
const RINGS = [1 / 3, 2 / 3, 1]
const NICE_RADII = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200]

interface Props {
  stores: Store[]
  center: Coords | null
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ProximityMap({ stores, center, selectedId, onSelect }: Props) {
  const { pins, scale } = useMemo(() => {
    const withCoords = stores.filter(
      (s): s is Store & { lat: number; lng: number } => s.lat !== null && s.lng !== null,
    )
    if (!withCoords.length) return { pins: [], scale: 1 }

    const origin: Coords = center ?? {
      lat: withCoords.reduce((a, s) => a + s.lat, 0) / withCoords.length,
      lng: withCoords.reduce((a, s) => a + s.lng, 0) / withCoords.length,
    }

    const measured = withCoords.map((s) => ({
      store: s as Store,
      km: distanceKm(origin, { lat: s.lat, lng: s.lng }),
      bearing: bearingDeg(origin, { lat: s.lat, lng: s.lng }),
    }))

    const furthest = Math.max(...measured.map((m) => m.km), 0.2)
    const nice = NICE_RADII.find((r) => r >= furthest) ?? Math.ceil(furthest)

    return {
      scale: nice,
      pins: measured.map((m) => {
        const rad = ((m.bearing - 90) * Math.PI) / 180
        const r = Math.min(1, m.km / nice) * R_MAX
        return { ...m, x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }
      }),
    }
  }, [stores, center])

  if (!pins.length) {
    return (
      <div
        className="map-wrap"
        style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', padding: 28 }}
      >
        <p className="small center" style={{ maxWidth: '30ch' }}>
          Shops appear here once they have a location saved.
        </p>
      </div>
    )
  }

  return (
    <div className="map-wrap">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ display: 'block', width: '100%' }}
        role="img"
        aria-label={`Map of ${pins.length} shops around you`}
      >
        <rect width={SIZE} height={SIZE} style={{ fill: 'var(--surface-2)' }} />

        {RINGS.map((f) => (
          <circle
            key={f}
            cx={C}
            cy={C}
            r={R_MAX * f}
            strokeWidth="1"
            strokeDasharray={f === 1 ? undefined : '3 5'}
            style={{ fill: 'none', stroke: 'var(--line)' }}
          />
        ))}

        {RINGS.map((f) => (
          <text
            key={`label-${f}`}
            x={C + 5}
            y={C - R_MAX * f + 12}
            fontSize="9"
            style={{ fill: 'var(--faint)', fontFamily: 'var(--font-mono)' }}
          >
            {formatDistance(scale * f)}
          </text>
        ))}

        <path d={`M${C} 15 l4 8 -8 0 z`} style={{ fill: 'var(--faint)' }} />
        <text
          x={C}
          y={11}
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          style={{ fill: 'var(--faint)' }}
        >
          N
        </text>

        {/* You are here */}
        <circle cx={C} cy={C} r="13" style={{ fill: 'var(--brand)', opacity: 0.16 }} />
        <circle
          cx={C}
          cy={C}
          r="5"
          strokeWidth="2"
          style={{ fill: 'var(--brand)', stroke: 'var(--surface)' }}
        />

        {pins.map((p) => {
          const on = p.store.id === selectedId
          return (
            <g
              key={p.store.id}
              className="map-pin"
              role="button"
              tabIndex={0}
              aria-label={`${p.store.name}, ${formatDistance(p.km)} away`}
              onClick={() => onSelect(p.store.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(p.store.id)}
            >
              <line
                x1={C}
                y1={C}
                x2={p.x}
                y2={p.y}
                strokeWidth="1"
                strokeDasharray="2 4"
                style={{ stroke: 'var(--line-strong)', opacity: on ? 0.9 : 0.4 }}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={on ? 13 : 10}
                strokeWidth="2"
                style={{
                  fill: on ? 'var(--brand)' : 'var(--surface)',
                  stroke: on ? 'var(--brand)' : 'var(--brand-line)',
                }}
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize={on ? '12' : '10'}
                fontWeight="800"
                style={{
                  fill: on ? 'var(--brand-ink)' : 'var(--brand)',
                  fontFamily: 'var(--font-display)',
                  pointerEvents: 'none',
                }}
              >
                {p.store.name.trim().charAt(0).toUpperCase() || '?'}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="map-legend">
        <span>{center ? 'Centred on you' : 'Centred on the shops'}</span>
        <span className="mono">Outer ring {formatDistance(scale)}</span>
      </div>
    </div>
  )
}
