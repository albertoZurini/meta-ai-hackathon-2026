const ALLOWED = new Set([
  'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan',
])
const ALLOWED_ATTR = /^(d|cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|width|height|points|fill|stroke|stroke-width|stroke-linejoin|stroke-linecap|opacity|transform|font-size|font-weight|text-anchor)$/

/** Keep only simple shape elements and presentation attributes from model-generated SVG. */
export function sanitizeSvg(svg: string): string {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`, 'image/svg+xml')
  const root = doc.documentElement
  if (root.querySelector('parsererror')) return ''
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (!ALLOWED.has(child.tagName.toLowerCase())) {
        child.remove()
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        if (!ALLOWED_ATTR.test(attr.name) || /url\(|javascript:/i.test(attr.value)) child.removeAttribute(attr.name)
      }
      walk(child)
    }
  }
  walk(root)
  return root.innerHTML
}
