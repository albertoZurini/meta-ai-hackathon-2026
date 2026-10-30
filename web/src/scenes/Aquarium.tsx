import { FishCanvas } from './FishCanvas'

const INK = '#1F2430'

/** 600×800 portrait aquarium background with swimming fish. */
export function Aquarium({ bottle }: { bottle: boolean }) {
  return (
    <>
    <svg viewBox="0 0 600 800" className="layer" preserveAspectRatio="xMidYMid slice">
      <rect width="600" height="800" fill="#DFF1FB" />
      <rect y="60" width="600" height="740" fill="#7CC4E8" />
      <path className="wave" d="M0 60 Q50 50 100 60 T200 60 T300 60 T400 60 T500 60 T600 60 T700 60 T800 60"
        fill="none" stroke="#fff" strokeWidth="4" opacity=".8" />
      <path d="M0 730 Q100 700 200 726 T400 718 T600 724 V800 H0 Z" fill="#E8D3A2" stroke={INK} strokeWidth="3" />
      <g className="weed"><path d="M60 732 Q36 620 72 540 Q48 640 88 732 Z" fill="#3FA36B" stroke={INK} strokeWidth="3" /></g>
      <g className="weed" style={{ animationDelay: '-1.5s' }}><path d="M96 732 Q118 660 102 610 Q134 664 120 732 Z" fill="#2F8A57" stroke={INK} strokeWidth="3" /></g>
      <g className="weed" style={{ animationDelay: '-1s' }}><path d="M500 728 Q482 600 522 520 Q512 620 544 728 Z" fill="#3FA36B" stroke={INK} strokeWidth="3" /></g>
      <g className="weed" style={{ animationDelay: '-2s' }}><path d="M544 728 Q566 650 548 600 Q582 656 568 728 Z" fill="#2F8A57" stroke={INK} strokeWidth="3" /></g>
      <ellipse cx="320" cy="732" rx="46" ry="20" fill="#9CA3AF" stroke={INK} strokeWidth="3" />
      <ellipse cx="372" cy="738" rx="26" ry="14" fill="#B8BEC6" stroke={INK} strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} className="bubble" cx={360 + (i % 2) * 10} cy="712" r={4 + (i % 3)} fill="#fff" opacity=".7"
          style={{ animationDelay: `${i * 1.1}s` }} />
      ))}
    </svg>
    <FishCanvas />
    <svg viewBox="0 0 600 800" className="layer" preserveAspectRatio="xMidYMid slice">
      {bottle && (
        <g className="bottle">
          <g transform="translate(250 80)">
            <rect x="0" y="0" width="70" height="34" rx="16" fill="#BFE6FF" fillOpacity=".8" stroke={INK} strokeWidth="3" />
            <rect x="68" y="9" width="16" height="16" rx="4" fill="#C8894A" stroke={INK} strokeWidth="3" />
            <rect x="14" y="9" width="40" height="16" rx="3" fill="#fff" stroke={INK} strokeWidth="2" />
            <path d="M18 13 L34 19 L50 13" fill="none" stroke={INK} strokeWidth="2" />
          </g>
        </g>
      )}
    </svg>
    </>
  )
}
