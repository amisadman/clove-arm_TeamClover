export interface KeyPosition {
  x: number
  y: number
  z: number
}

export interface KeyConfig {
  frame: string
  units: string
  approach_axis: string
  keys: Record<string, KeyPosition>
}

interface KeyConfigStore {
  config: KeyConfig | null
  listeners: Set<() => void>
}

const store: KeyConfigStore = { config: null, listeners: new Set() }

export function setKeyConfig(config: KeyConfig) {
  store.config = config
  store.listeners.forEach((listener) => listener())
}

export function getKeyConfig(): KeyConfig | null {
  return store.config
}

export function subscribeKeyConfig(listener: () => void): () => void {
  store.listeners.add(listener)
  return () => store.listeners.delete(listener)
}
