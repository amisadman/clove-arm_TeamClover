import type { Vec3 } from '../kinematics/types'

export type MotionCommand =
  | { type: 'JOG'; delta: Vec3 }
  | { type: 'MOVE_TO'; target: Vec3; speed?: number } // speed (m/s) overrides the default distance-based duration
  | { type: 'HOME' }

type Listener = (command: MotionCommand) => void

const listeners = new Set<Listener>()

export function emit(command: MotionCommand) {
  listeners.forEach((listener) => listener(command))
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
