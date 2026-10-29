export type Keyframe = {
  t: number
  translateX?: number
  translateY?: number
  rotate?: number
  scale?: number
  scaleX?: number
  scaleY?: number
  opacity?: number
}

export type Track = {
  target: string
  keyframes: Keyframe[]
  easing?: string
  iterations?: number
}

export type Prop = { id: string; slot: string; x: number; y: number; svg: string }

export type Performance = {
  title: string
  duration_ms: number
  props: Prop[]
  tracks: Track[]
  bubble: { t: number; text: string }[]
}

export type BBox = { x: number; y: number; w: number; h: number }

export type Accessory = { url: string; slot: string; bbox: BBox }

/** AI-placed accessory: box in percent of the 200×200 duck, attached to a part so it moves with it. */
export type Placement = { x: number; y: number; w: number; h: number; rotate: number }
export type PlacedAccessory = { url: string; attach_to: 'head' | 'body' | 'hand-r' | 'duck'; placement: Placement }

export type Draft = {
  id: string
  created: number
  lab: boolean
  live: boolean
  message: string
  quality: number
  bbox: BBox | null
  doodle: string | null
  composite: string | null
  accessory: PlacedAccessory | null
  accessory_raw: string | null
  label: string
  css: string
  css_check: { ok: boolean; notes: string[] }
  duration_ms: number
  bubble: string
  timings: Record<string, number>
  raw: unknown
}

export type Message = {
  id: string
  created: number
  friend_id: string
  from_name: string
  prompt: string
  text: string
  video: string | null
  transcript: string
  accessory: Accessory | null
  performance: Performance
  status: 'pending' | 'viewed'
  // AI-generated (draft) messages:
  css?: string
  duration_ms?: number
  bubble?: string
  label?: string
  placed?: PlacedAccessory | null
}

export type Reply = {
  id: string
  created: number
  kind: 'video' | 'gift' | 'photo'
  video?: string
  photo?: string
  transcript?: string
  label?: string
  cutout?: string
  performance: Performance
}

export type ShowTell = { id: string; label: string; cutout: string; performance: Performance }
