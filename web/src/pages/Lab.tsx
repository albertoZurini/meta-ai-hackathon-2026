import { useEffect, useState } from 'react'
import { api } from '../api'
import { CssDuck } from '../components/CssDuck'
import { COLORS, DrawPad, DrawTools, QualitySlider, SIZES, exportDrawing } from '../components/DrawPad'
import type { Stroke } from '../components/DrawPad'
import type { Draft } from '../duck/types'

type Col = { key: number; saved?: Draft }
let nextKey = 1

const ROWS = ['Input', 'Image model output', 'Result', 'Model output', 'Stats']

const ms = (v?: number) => (v == null ? '–' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

async function urlBlob(url: string | null): Promise<Blob | undefined> {
  if (!url) return undefined
  const r = await fetch(url)
  return r.ok ? r.blob() : undefined
}

function LoopDuck({ draft }: { draft: Draft }) {
  const [playKey, setPlayKey] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setPlayKey((k) => k + 1), (draft.duration_ms || 2000) + 800)
    return () => clearInterval(t)
  }, [draft.id, draft.duration_ms])
  return (
    <>
      <div className="lab-stage">
        <CssDuck css={draft.css} placed={draft.accessory} playKey={playKey} bubble={draft.bubble} />
      </div>
      <button className="small ghost" onClick={() => setPlayKey((k) => k + 1)}>↻ Replay</button>
    </>
  )
}

function Column({ col, onRemove, onDuplicate, onRun }: {
  col: Col; onRemove: () => void; onDuplicate: () => void; onRun: (d: Draft) => void
}) {
  const editable = !col.saved
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [quality, setQuality] = useState(col.saved?.quality ?? 0.5)
  const [message, setMessage] = useState(col.saved?.message ?? '')
  const [history, setHistory] = useState<Draft[]>(col.saved ? [col.saved] : [])
  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const d = history[idx] as Draft | undefined

  const generate = async () => {
    setBusy(true)
    setError('')
    try {
      let fields: Parameters<typeof api.draft>[0]
      if (editable) {
        const ex = await exportDrawing(strokes)
        if (!ex) throw new Error('Draw something first')
        fields = { message, quality, doodle: ex.doodle, composite: ex.composite, bbox: JSON.stringify(ex.bbox), lab: true }
      } else {
        const src = col.saved!
        fields = {
          message: src.message, quality: src.quality, lab: true,
          doodle: await urlBlob(src.doodle), composite: await urlBlob(src.composite),
          bbox: src.bbox ? JSON.stringify(src.bbox) : undefined,
        }
      }
      const res = await api.draft(fields)
      setHistory((h) => [...h, res])
      setIdx(history.length)
      onRun(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const t = d?.timings ?? {}
  const total = d ? (t.total_ms ?? (t.spark_ms ?? 0) + (t.image_ms ?? 0)) : undefined

  return (
    <div className="lab-col">
      <div className="lab-col-head">
        <b>{editable ? 'New test' : 'Saved run'}</b>
        {history.length > 1 && (
          <span className="lab-hist">
            <button className="small ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>◀</button>
            {idx + 1}/{history.length}
            <button className="small ghost" disabled={idx === history.length - 1} onClick={() => setIdx(idx + 1)}>▶</button>
          </span>
        )}
        <button className="small ghost" title="Remove column (UI only)" onClick={onRemove}>✕</button>
      </div>

      {/* 1. Input */}
      <div className="lab-cell">
        {editable ? (
          <>
            <DrawPad strokes={strokes} onChange={setStrokes} color={color} size={size} />
            <DrawTools color={color} setColor={setColor} size={size} setSize={setSize} strokes={strokes} onChange={setStrokes} />
            <QualitySlider value={quality} onChange={setQuality} />
            <input className="lab-input" placeholder="Friend's message…" value={message} onChange={(e) => setMessage(e.target.value)} />
          </>
        ) : (
          <>
            {col.saved!.composite ? <img className="lab-img sky" src={col.saved!.composite} alt="composite" /> : <div className="lab-empty">no composite</div>}
            <div className="lab-kv"><span>message</span><b>“{col.saved!.message}”</b></div>
            <div className="lab-kv"><span>quality</span><b>{col.saved!.quality.toFixed(2)}</b></div>
          </>
        )}
        <div className="lab-actions">
          <button disabled={busy || (editable && !strokes.length)} onClick={generate}>
            {history.length ? '↻ Regenerate' : 'Generate (live, ~2¢)'}
          </button>
          {!editable && <button className="ghost" onClick={onDuplicate}>Duplicate as new</button>}
        </div>
        {busy && <div className="lab-busy"><span className="lab-spin" /> Muse Spark + Muse Image working…</div>}
        {error && <div className="lab-error">{error}</div>}
      </div>

      {/* 2. Image model output */}
      <div className="lab-cell">
        {d ? (
          <div className="lab-pair">
            <figure>{d.accessory_raw ? <img className="lab-img" src={d.accessory_raw} alt="raw" /> : <div className="lab-empty">–</div>}<figcaption>raw</figcaption></figure>
            <figure>{d.accessory ? <img className="lab-img checker" src={d.accessory.url} alt="keyed" /> : <div className="lab-empty">–</div>}<figcaption>keyed</figcaption></figure>
          </div>
        ) : <div className="lab-empty">not run yet</div>}
      </div>

      {/* 3. Result */}
      <div className="lab-cell">{d ? <LoopDuck key={d.id} draft={d} /> : <div className="lab-empty">not run yet</div>}</div>

      {/* 4. Model output */}
      <div className="lab-cell">
        {d ? (
          <>
            <div className="lab-kv"><span>label</span><b>{d.label}</b></div>
            <div className="lab-kv"><span>attach_to</span><b>{d.accessory?.attach_to ?? '–'}</b></div>
            <div className="lab-kv"><span>placement</span><b>{d.accessory ? (['x', 'y', 'w', 'h', 'rotate'] as const).map((k) => `${k} ${Math.round(d.accessory!.placement[k])}`).join(' · ') : '–'}</b></div>
            <div className="lab-kv"><span>bubble</span><b>{d.bubble || '–'}</b></div>
            <div className="lab-kv"><span>duration</span><b>{ms(d.duration_ms)}</b></div>
            <div className={`lab-badge ${d.css_check.ok ? 'ok' : 'bad'}`}>{d.css_check.ok ? 'compiled ✓' : 'fallback'}</div>
            {d.css_check.notes.length > 0 && <ul className="lab-notes">{d.css_check.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            <pre className="lab-css">{d.css}</pre>
          </>
        ) : <div className="lab-empty">not run yet</div>}
      </div>

      {/* 5. Stats */}
      <div className="lab-cell">
        {d ? (
          <>
            <div className="lab-kv"><span>Muse Spark</span><b>{ms(t.spark_ms)}</b></div>
            <div className="lab-kv"><span>Muse Image</span><b>{ms(t.image_ms)}</b></div>
            <div className="lab-kv"><span>total</span><b>{ms(total)}</b></div>
            <div className="lab-kv"><span>created</span><b>{new Date(d.created * (d.created < 1e12 ? 1000 : 1)).toLocaleString()}</b></div>
            <div className="lab-kv"><span>id</span><code>{d.id}</code></div>
          </>
        ) : <div className="lab-empty">not run yet</div>}
      </div>
    </div>
  )
}

export default function Lab() {
  const [cols, setCols] = useState<Col[]>([])
  const [runs, setRuns] = useState<Draft[]>([])
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    api.labRuns()
      .then((rs) => {
        const sorted = [...rs].sort((a, b) => a.created - b.created)
        setRuns(sorted)
        setCols(sorted.length ? sorted.map((saved) => ({ key: nextKey++, saved })) : [{ key: nextKey++ }])
      })
      .catch((e) => {
        setLoadErr(String(e.message ?? e))
        setCols([{ key: nextKey++ }])
      })
  }, [])

  const addCol = () => setCols((c) => [...c, { key: nextKey++ }])
  const compiled = runs.filter((r) => r.css_check?.ok).length
  const spark = avg(runs.map((r) => r.timings?.spark_ms).filter((v): v is number => v != null))
  const image = avg(runs.map((r) => r.timings?.image_ms).filter((v): v is number => v != null))

  return (
    <div className="lab">
      <header className="lab-header">
        <h1>🦆 Duck lab: QA for AI-generated ducks</h1>
        <p>Each column is one test case: a drawing + message goes through Muse Spark and Muse Image, and we check the placement, redrawn accessory and CSS animation.</p>
        <div className="lab-summary">
          <span><b>{runs.length}</b> runs</span>
          <span><b>{runs.length ? Math.round((100 * compiled) / runs.length) : 0}%</b> CSS compiled first try</span>
          <span>avg Spark <b>{ms(spark)}</b></span>
          <span>avg Image <b>{ms(image)}</b></span>
          {loadErr && <span className="lab-error">could not load runs: {loadErr}</span>}
        </div>
      </header>
      <div className="lab-scroll">
        <div className="lab-table">
          <div className="lab-col lab-labels">
            <div className="lab-col-head" />
            {ROWS.map((r) => <div key={r} className="lab-cell lab-label">{r}</div>)}
          </div>
          {cols.map((c) => (
            <Column key={c.key} col={c}
              onRemove={() => setCols((cs) => cs.filter((x) => x.key !== c.key))}
              onDuplicate={addCol}
              onRun={(d) => setRuns((rs) => [...rs, d])} />
          ))}
          <div className="lab-add"><button onClick={addCol}>+ Add column</button></div>
        </div>
      </div>
    </div>
  )
}
