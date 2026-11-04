import type { Draft, Message, Performance, Reply, ShowTell } from './duck/types'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init)
  if (!r.ok) {
    let detail = r.statusText
    try {
      detail = (await r.json()).detail ?? detail
    } catch {
      /* not json */
    }
    throw new Error(detail)
  }
  return r.json() as Promise<T>
}

function form(fields: Record<string, string | Blob | null | undefined>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) continue
    if (v instanceof Blob) f.append(k, v, k === 'video' ? `video.${v.type.includes('mp4') ? 'mp4' : 'webm'}` : `${k}.png`)
    else f.append(k, v)
  }
  return f
}

export const api = {
  /** AI draft: drawing + message → placement, redrawn accessory, CSS animation (lab=true always live). */
  draft: (fields: { message: string; quality: number; doodle?: Blob; composite?: Blob; bbox?: string; lab?: boolean }) => {
    const f = new FormData()
    f.append('message', fields.message)
    f.append('quality', fields.quality.toFixed(3))
    if (fields.bbox) f.append('bbox', fields.bbox)
    if (fields.lab) f.append('lab', 'true')
    if (fields.doodle) f.append('doodle', fields.doodle, 'doodle.png')
    if (fields.composite) f.append('composite', fields.composite, 'composite.png')
    return req<Draft>('/api/drafts', { method: 'POST', body: f })
  },
  labRuns: () => req<Draft[]>('/api/lab'),
  sendDraft: (fields: { owner: string; friend_id: string; from_name: string; text: string; draft_id: string }) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(fields)) f.append(k, v)
    return req<Message>('/api/messages', { method: 'POST', body: f })
  },
  performances: () => req<Record<string, Performance>>('/api/performances'),
  health: () => req<{ ok: boolean; mode: string; owner: string }>('/api/health'),
  pending: () => req<Message[]>('/api/messages/pending'),
  viewed: (id: string) => req<Message>(`/api/messages/${id}/viewed`, { method: 'POST' }),
  replyPhoto: (id: string, photo: Blob) => {
    const f = new FormData()
    f.append('photo', photo, 'reply.jpg')
    return req<Reply>(`/api/messages/${id}/reply`, { method: 'POST', body: f })
  },
  presence: (frame: Blob) =>
    req<{ present: boolean; holding: boolean; detections: unknown[]; ms: number }>('/api/presence', { method: 'POST', body: form({ frame }) }),
  showtell: (frame: Blob, hint = '') =>
    req<ShowTell>('/api/showtell', { method: 'POST', body: form({ frame, hint }) }),
  gift: (id: string, friendId: string) =>
    req<Reply>(`/api/showtell/${id}/gift`, { method: 'POST', body: form({ friend_id: friendId }) }),
  friends: () => req<{ friend_id: string; name: string }[]>('/api/friends'),
  send: (fields: {
    owner: string; friend_id: string; from_name: string; prompt: string; text: string; quality: string
    bbox?: string; doodle?: Blob | null; video?: Blob | null
  }) => req<Message>('/api/messages', { method: 'POST', body: form(fields) }),
  replies: (owner: string, friendId: string) =>
    req<Reply[]>(`/api/f/${owner}/replies?friend_id=${encodeURIComponent(friendId)}`),
}
