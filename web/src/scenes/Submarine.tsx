import type { ReactNode } from 'react'

const INK = '#1F2430'

/** Submarine (viewBox 440×240). The porthole (center 224,140 r 60) shows `children` (a Duck). */
export function Submarine({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 440 240" className="sub-svg" style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id="porthole-clip"><circle cx="224" cy="140" r="58" /></clipPath>
      </defs>
      <rect x="190" y="12" width="68" height="60" rx="12" fill="#E4572E" stroke={INK} strokeWidth="5" />
      <rect x="208" y="0" width="10" height="24" fill={INK} />
      <rect x="20" y="60" width="380" height="160" rx="80" fill="#E4572E" stroke={INK} strokeWidth="5" />
      <path d="M400 120 L436 88 L436 192 L400 160 Z" fill="#C4441F" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <g className="propeller"><ellipse cx="436" cy="140" rx="6" ry="30" fill="#F2B705" stroke={INK} strokeWidth="4" /></g>
      <circle cx="100" cy="140" r="16" fill="#BFE6FF" stroke={INK} strokeWidth="5" />
      <circle cx="340" cy="140" r="16" fill="#BFE6FF" stroke={INK} strokeWidth="5" />
      <circle cx="224" cy="140" r="60" fill="#BFE6FF" />
      <g clipPath="url(#porthole-clip)">
        <foreignObject x="164" y="80" width="120" height="120">
          <div className="porthole-duck">{children}</div>
        </foreignObject>
      </g>
      <circle cx="224" cy="140" r="60" fill="none" stroke={INK} strokeWidth="8" />
      <path d="M190 104 Q204 92 222 90" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".8" />
    </svg>
  )
}
