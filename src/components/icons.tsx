/** Line icons on a 24px grid, 1.75 stroke, so weights match across the app. */
type P = { size?: number; className?: string; fill?: boolean }

const Svg = ({
  size = 20,
  className,
  children,
  fill,
}: P & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Svg>
)

export const Pin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
)

export const ChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const ChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
)

export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)

export const Heart = (p: P) => (
  <Svg {...p}>
    <path d="M12 20s-7.5-4.7-7.5-9.8A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20Z" />
  </Svg>
)

export const Star = (p: P) => (
  <Svg {...p}>
    <path d="m12 4 2.3 4.9 5.2.7-3.8 3.7 1 5.3L12 16.1 7.3 18.6l1-5.3L4.5 9.6l5.2-.7L12 4Z" />
  </Svg>
)

export const Clock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Svg>
)

export const Plus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const Minus = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const X = (p: P) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
)

export const Bag = (p: P) => (
  <Svg {...p}>
    <path d="M6 8h12l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-7A1.5 1.5 0 0 1 7 19.5L6 8Z" />
    <path d="M9.2 8V6.2a2.8 2.8 0 0 1 5.6 0V8" />
  </Svg>
)

export const Home = (p: P) => (
  <Svg {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.5Z" />
  </Svg>
)

export const MapIcon = (p: P) => (
  <Svg {...p}>
    <path d="m3 6.5 6-2.2 6 2.2 6-2.2v13.2l-6 2.2-6-2.2-6 2.2V6.5Z" />
    <path d="M9 4.3v15.2M15 6.5v15.2" />
  </Svg>
)

export const User = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
  </Svg>
)

export const Camera = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.6h3.2L8.6 6h6.8l1.4 2.6H20a1.4 1.4 0 0 1 1.4 1.4v8A1.4 1.4 0 0 1 20 19.4H4A1.4 1.4 0 0 1 2.6 18v-8A1.4 1.4 0 0 1 4 8.6Z" />
    <circle cx="12" cy="13.6" r="3.2" />
  </Svg>
)

export const Trash = (p: P) => (
  <Svg {...p}>
    <path d="M5 7h14M10 7V5.4A1.4 1.4 0 0 1 11.4 4h1.2A1.4 1.4 0 0 1 14 5.4V7" />
    <path d="M6.5 7 7.4 19a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3L17.5 7" />
  </Svg>
)

export const Pencil = (p: P) => (
  <Svg {...p}>
    <path d="M15.8 4.6 19.4 8.2 8.6 19H5v-3.6L15.8 4.6Z" />
  </Svg>
)

export const Check = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
)

export const Crosshair = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2.4v2.6M12 19v2.6M2.4 12H5M19 12h2.6" />
  </Svg>
)

export const Info = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.2M12 8.2h.01" />
  </Svg>
)

export const Lock = (p: P) => (
  <Svg {...p}>
    <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2" />
    <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
  </Svg>
)

export const Cloud = (p: P) => (
  <Svg {...p}>
    <path d="M7.2 18.5a4.2 4.2 0 0 1-.5-8.4 5.6 5.6 0 0 1 10.8-1.3 3.9 3.9 0 0 1 .6 7.7" />
    <path d="M7.2 18.5h10.7" />
  </Svg>
)

export const Phone = (p: P) => (
  <Svg {...p}>
    <rect x="6.5" y="2.8" width="11" height="18.4" rx="2.4" />
    <path d="M10.8 18.2h2.4" />
  </Svg>
)

export const Leaf = (p: P) => (
  <Svg {...p}>
    <path d="M5 19c0-7.5 5.5-13 14-13 0 8.5-5.5 14-13 14H5v-1Z" />
    <path d="M9 15.5c1.8-2.6 4-4.6 7-6" />
  </Svg>
)

/** The empty-state illustration: a paper bag tied with a tag. */
export const BagArt = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 132 132" className={className} role="img" aria-label="An empty paper bag">
    <path
      d="M33 46h66l-5.5 66.5A9 9 0 0 1 84.5 121h-37a9 9 0 0 1-9-8.5L33 46Z"
      fill="currentColor"
      opacity="0.11"
    />
    <path
      d="M33 46h66l-5.5 66.5A9 9 0 0 1 84.5 121h-37a9 9 0 0 1-9-8.5L33 46Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M48 46V32a18 18 0 0 1 36 0v14"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path d="M33 46h66" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path
      d="M55 74h22M55 88h14"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.42"
    />
    <circle cx="99" cy="34" r="12" fill="currentColor" opacity="0.14" />
    <path
      d="M94.5 34h9M99 29.5v9"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
)
