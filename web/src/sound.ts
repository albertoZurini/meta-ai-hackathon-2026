/** Duck quack (public/quack.mp3). Browsers may block audio until the page gets a click. */
const audio = typeof Audio !== 'undefined' ? new Audio('/quack.mp3') : null
let blocked = false
const listeners = new Set<(b: boolean) => void>()

export function onAudioBlocked(fn: (b: boolean) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function setBlocked(b: boolean) {
  blocked = b
  listeners.forEach((fn) => fn(b))
}

export async function quack(times = 1, gapMs = 380) {
  if (!audio) return
  for (let i = 0; i < times; i++) {
    try {
      const a = audio.cloneNode() as HTMLAudioElement
      await a.play()
      if (blocked) setBlocked(false)
    } catch {
      setBlocked(true)
      return
    }
    if (i < times - 1) await new Promise((r) => setTimeout(r, gapMs))
  }
}

/** Call from a click handler to unlock audio. */
export function unlockAudio() {
  quack(1)
}
