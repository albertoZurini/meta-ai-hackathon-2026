import { forwardRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Accessory, PlacedAccessory, Prop } from './types'
import { sanitizeSvg } from './sanitize'

const INK = '#1F2430'
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const

// Pivots from docs/DUCK-STYLE.md section 3.
const PIVOT: Record<string, [number, number]> = {
  duck: [100, 190],
  body: [100, 140],
  head: [120, 90],
  beak: [150, 70],
  eye: [132, 58],
  wing: [80, 130],
  'hand-l': [60, 140],
  'hand-r': [150, 140],
  feet: [100, 188],
  finger: [160, 125],
  thumbs: [172, 118],
  'hand-no': [155, 128], // hand's own center: it wags in place on the chest
  thumb: [160, 125],
}

const SLOT_PARENT: Record<string, string> = {
  hat: 'head', face: 'head', neck: 'body', body: 'body', back: 'body', held: 'hand-r',
}

/**
 * Pointing hand (index up, three folded fingers, thumb), one outlined silhouette.
 * Drawn in a 60×80 box; placed with a static transform so animations can move the parent group.
 */
function PointingHand({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M10 10 A6 6 0 0 1 22 10 L22 26 A6 6 0 0 1 34 26 L34 28 A6 6 0 0 1 46 28 L46 32 A6 6 0 0 1 58 32
           L58 58 Q58 76 40 76 L26 76 Q18 76 12 68 L3 55 Q-1 48 6 44 L10 41 Z"
        fill="#fff" stroke={INK} strokeWidth={3 / scale} strokeLinejoin="round" />
      <path d="M22 26 V38 M34 28 V38 M46 32 V38 M10 41 V52" fill="none" stroke={INK} strokeWidth={2.4 / scale}
        strokeLinecap="round" />
    </g>
  )
}

/** Thumbs-up fist (thumb up, four stacked fingers), white with ink outline. 60×70 box. */
function ThumbsUpHand({ x, y, scale }: { x: number; y: number; scale: number }) {
  const sw = 3 / scale
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M12 34 L12 9 A8 8 0 0 1 28 9 L28 28 L46 28 A5 5 0 0 1 46 38 A5 5 0 0 1 46 48 A5 5 0 0 1 46 58
           A5 5 0 0 1 46 68 L20 68 Q6 68 6 56 L6 42 Q6 34 12 34 Z"
        fill="#fff" stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M30 38 H46 M30 48 H46 M30 58 H46" fill="none" stroke={INK} strokeWidth={2.4 / scale}
        strokeLinecap="round" />
    </g>
  )
}

function part(name: string, extra?: CSSProperties): { 'data-part': string; style: CSSProperties } {
  const [x, y] = PIVOT[name] ?? [100, 100]
  return {
    'data-part': name,
    style: { transformBox: 'view-box', transformOrigin: `${x}px ${y}px`, ...extra },
  }
}

export type NoHandStyle = 'drawn'
export const NO_HAND_STYLES: NoHandStyle[] = ['drawn']

/** AI-placed accessory (percent box), rendered inside the part it is attached to. */
function Placed({ a }: { a: PlacedAccessory }) {
  const { x, y, w, h, rotate } = a.placement
  const [px, py, pw, ph] = [x * 2, y * 2, w * 2, h * 2]
  return (
    <g data-part="accessory" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      <image href={a.url} x={px} y={py} width={pw} height={ph} preserveAspectRatio="xMidYMid meet"
        transform={rotate ? `rotate(${rotate} ${px + pw / 2} ${py + ph / 2})` : undefined} />
    </g>
  )
}

type Props = {
  /** Accessory placed by the AI (attach_to decides which part it moves with). */
  placed?: PlacedAccessory | null
  /** Look of the raised "no" hand (see /gallery). */
  noHand?: NoHandStyle
  accessories?: Accessory[]
  held?: string | null // image URL placed in the right hand
  props?: Prop[]
  showHands?: boolean
  className?: string
  style?: CSSProperties
}

export const Duck = forwardRef<SVGSVGElement, Props>(function Duck(
  { accessories = [], held = null, props = [], showHands = false, noHand = 'drawn', placed = null, className, style },
  ref,
) {
  const acc = (parent: string, behind = false): ReactNode =>
    accessories
      .filter((a) => SLOT_PARENT[a.slot] === parent && (a.slot === 'back') === behind)
      .map((a) => (
        <image key={a.url} href={a.url} x={a.bbox.x} y={a.bbox.y} width={a.bbox.w} height={a.bbox.h}
          preserveAspectRatio="xMidYMid meet" />
      ))

  const handsOpacity = showHands || held || placed?.attach_to === 'hand-r' ? 1 : 0
  const put = (part: string) => (placed && placed.attach_to === part ? <Placed a={placed} /> : null)

  return (
    <svg ref={ref} viewBox="0 0 200 200" className={className} style={{ overflow: 'visible', ...style }}>
      <g {...part('duck')}>
        {acc('body', true)}
        <g {...part('feet')}>
          <path d="M78 178 L72 192 L92 192 Z" fill="#F28C28" {...S} />
          <path d="M112 178 L106 192 L126 192 Z" fill="#F28C28" {...S} />
        </g>
        <g {...part('body')}>
          <ellipse cx="100" cy="140" rx="62" ry="42" fill="#FFD23F" {...S} />
          <g {...part('wing')}>
            {/* Holding something: the wing stretches forward to the held object instead of drawing gloves. */}
            <path d={handsOpacity
              ? 'M58 132 Q92 106 146 122 Q150 134 140 138 Q100 158 64 150 Q54 142 58 132 Z'
              : 'M58 132 Q80 108 110 128 Q96 156 64 150 Q54 142 58 132 Z'} fill="#FFD23F" {...S} />
          </g>
          {acc('body')}
          {put('body')}
        </g>
        <g {...part('head')}>
          <circle cx="122" cy="70" r="34" fill="#FFD23F" {...S} />
          <g {...part('beak')}>
            <path d="M150 62 Q178 64 182 72 Q176 82 150 80 Z" fill="#F28C28" {...S} />
            <path d="M152 72 L178 72" fill="none" {...S} strokeWidth={2} />
          </g>
          <g {...part('eye')}>
            <circle cx="132" cy="58" r="5.5" fill={INK} />
            <circle cx="134" cy="56" r="1.8" fill="#fff" />
          </g>
          <path d="M100 88 Q108 96 114 88" fill="none" {...S} strokeWidth={2} opacity={0} />
          {acc('head')}
          {put('head')}
        </g>
        {/* Hands are invisible anchors (no gloves); kept so animations and held items can target them. */}
        <g {...part('hand-l', { opacity: handsOpacity })} />
        <g {...part('hand-r', { opacity: handsOpacity })}>
          {held && <image href={held} x="140" y="80" width="80" height="80" preserveAspectRatio="xMidYMid meet" />}
          <g {...part('finger', { opacity: 0 })}>
            <rect x="155" y="104" width="9" height="28" rx="4.5" fill="#fff" {...S} />
          </g>
          <g {...part('thumb', { opacity: 0 })}>
            <rect x="148" y="108" width="10" height="26" rx="5" fill="#fff" {...S} />
          </g>
          {acc('hand-r')}
          {put('hand-r')}
        </g>
        {/* Raised hand with the index finger up (used by the "no" wag). Style picked in /gallery. */}
        <g {...part('hand-no', { opacity: 0 })}>
          {/* No arm: the hand sits on the chest, centered at the 'hand-no' pivot (155,128). */}
          {noHand === 'drawn' && <PointingHand x={140} y={108} scale={0.5} />}
        </g>
        {/* Thumbs up (drawn, white), shown by the THUMBS reaction. */}
        <g {...part('thumbs', { opacity: 0 })}>
          <ThumbsUpHand x={152} y={92} scale={0.6} />
        </g>
        {props.map((p) => (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
            <g {...part(p.id)} dangerouslySetInnerHTML={{ __html: sanitizeSvg(p.svg) }} />
          </g>
        ))}
        {put('duck')}
      </g>
    </svg>
  )
})
