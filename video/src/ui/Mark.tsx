// The Lookup mark (site/brand/mark.svg): a cursive "l" in one stroke on a plum tile. `draw` animates
// the stroke on, 0..1. ids are suffixed so several marks can share a page.

export function LookupMark({ size, draw = 1, id = "m" }: { size: number; draw?: number; id?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: "block", flex: "none" }}>
      <defs>
        <clipPath id={`lk-sq-${id}`}><rect width="64" height="64" rx="15" /></clipPath>
        <linearGradient id={`lk-bg-${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#43218A" /><stop offset="1" stopColor="#160B30" />
        </linearGradient>
        <radialGradient id={`lk-hi-${id}`} cx="0.3" cy="0.05" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity=".3" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`lk-ink-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F5EDFF" /><stop offset=".55" stopColor="#D8B4FE" /><stop offset="1" stopColor="#B98AD6" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#lk-sq-${id})`}>
        <rect width="64" height="64" fill={`url(#lk-bg-${id})`} />
        <rect width="64" height="64" fill={`url(#lk-hi-${id})`} />
        <path d="M -6 52 C 12 51, 33 43, 45 28 C 52 19, 52 8, 41 7.5 C 30 7, 19.5 16, 19.5 30 C 19.5 42, 24.5 52, 34 55.5 C 44 59, 56 55, 70 48"
          fill="none" stroke={`url(#lk-ink-${id})`} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round"
          pathLength={1} strokeDasharray={`${draw} 1`} />
        <rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="none" stroke="#fff" strokeOpacity=".14" />
      </g>
    </svg>
  );
}
