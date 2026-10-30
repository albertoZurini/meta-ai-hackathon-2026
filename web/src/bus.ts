import { useEffect, useRef, useState } from 'react'
import type { ShowTell } from './duck/types'

/** Events exchanged between the tank screen and the camera page via /api/bus. */
export type BusEvent =
  | { type: 'peer'; role: string; online: boolean }
  // camera → tank
  | { type: 'wake' }
  | { type: 'key'; key: string }
  | { type: 'showtell-start' }
  | { type: 'showtell-result'; item: ShowTell }
  | { type: 'showtell-error'; error: string }
  | { type: 'snap-done'; ok: boolean; photo?: string; error?: string }
  // tank → camera
  | { type: 'phase'; phase: string }
  | { type: 'stream'; on: boolean }
  | { type: 'snap'; messageId: string; name: string }

export function send(to: 'tank' | 'camera', event: BusEvent) {
  return fetch(`/api/bus/${to}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => {})
}

/** Subscribe to events for `role`; returns whether the other side is connected. */
export function useBus(role: 'tank' | 'camera', onEvent: (e: BusEvent) => void) {
  const handler = useRef(onEvent)
  handler.current = onEvent
  const [peer, setPeer] = useState(false)

  useEffect(() => {
    let es: EventSource | null = null
    let retry: number | undefined
    let closed = false
    const other = role === 'tank' ? 'camera' : 'tank'

    const connect = () => {
      es = new EventSource(`/api/bus/${role}`)
      es.onopen = () => {
        // Ask who's online once connected.
        fetch('/api/bus').then((r) => r.json()).then((p: Record<string, number>) => {
          const online = (p[other] ?? 0) > 0
          setPeer(online)
          handler.current({ type: 'peer', role: other, online })
        }).catch(() => {})
      }
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as BusEvent
        if (e.type === 'peer') setPeer(e.online)
        handler.current(e)
      }
      // EventSource gives up for good on HTTP errors (e.g. backend restarting): reconnect ourselves.
      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED && !closed) {
          setPeer(false)
          retry = window.setTimeout(connect, 2000)
        }
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      es?.close()
    }
  }, [role])

  return peer
}

/** Live camera frames (JPEG over WebSocket, relayed by the backend). */
export function streamUrl(role: 'tank' | 'camera') {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/ws/stream/${role}`
}
