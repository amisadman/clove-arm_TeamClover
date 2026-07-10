export interface ToastMessage {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
}

type Listener = (toast: ToastMessage) => void

let nextId = 1
const listeners = new Set<Listener>()

export function pushToast(text: string, tone: ToastMessage['tone'] = 'info') {
  const toast: ToastMessage = { id: nextId++, text, tone }
  listeners.forEach((listener) => listener(toast))
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
