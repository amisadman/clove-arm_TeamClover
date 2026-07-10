export interface KeyFlashEvent {
  label: string
  tone: 'success' | 'error'
}

type Listener = (event: KeyFlashEvent) => void

const listeners = new Set<Listener>()

export function flashKey(label: string, tone: KeyFlashEvent['tone']) {
  listeners.forEach((listener) => listener({ label, tone }))
}

export function subscribeKeyFlash(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
