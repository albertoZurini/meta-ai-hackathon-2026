import { forwardRef, useEffect, useId, useState } from 'react'
import type { ComponentProps } from 'react'
import { Duck } from '../duck/Duck'

/**
 * A Duck that plays model-generated CSS (already sanitized by the backend).
 * Selectors and keyframe names are scoped to this instance so several ducks can play different CSS.
 */
type Props = ComponentProps<typeof Duck> & {
  css: string | null
  /** Change this number to (re)start the animation. */
  playKey?: number
  bubble?: string | null
}

export function scopeCss(css: string, scope: string): string {
  return css
    .replace(/\bdk-([A-Za-z0-9_-]+)/g, `dk-${scope}-$1`)
    .replace(/\[data-part="([a-z-]+)"\]/g, `.${scope} [data-part="$1"]`)
}

export const CssDuck = forwardRef<SVGSVGElement, Props>(function CssDuck({ css, playKey = 0, bubble, ...duck }, ref) {
  const scope = 'dk' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [showBubble, setShowBubble] = useState(false)
  useEffect(() => {
    if (!bubble) return
    setShowBubble(true)
    const t = setTimeout(() => setShowBubble(false), 2500)
    return () => clearTimeout(t)
  }, [bubble, playKey])
  return (
    <div className={`css-duck ${scope}`}>
      {css && <style key={`s${playKey}`}>{scopeCss(css, scope)}</style>}
      {showBubble && bubble && <div className="css-duck-bubble">{bubble}</div>}
      {/* key remounts the SVG so CSS animations restart from 0 */}
      <Duck key={`d${playKey}`} ref={ref} {...duck} />
    </div>
  )
})
