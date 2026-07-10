import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { getRobot } from '../sim/robotStore'
import { fk, currentJointVector } from '../kinematics/solverTwin'
import { solveIK } from '../kinematics/ikDLS'
import { validate } from './safetyGate'
import { subscribe, type MotionCommand } from './commandBus'
import { JOINT_ORDER, type JointVector } from '../kinematics/jointOrder'
import type { Vec3 } from '../kinematics/types'
import { telemetryRef } from '../dashboard/telemetry'
import { pushToast } from '../dashboard/toast'

const JOG_TOAST_THROTTLE_MS = 1200
const WARM_START_MAX_ITER = 5

type MotionState =
  | { kind: 'idle' }
  | { kind: 'moveTo'; startPos: Vec3; endPos: Vec3; startTime: number; duration: number }
  | { kind: 'jointMove'; startQ: JointVector; endQ: JointVector; startTime: number; duration: number }

export interface MoveCompleteInfo {
  ok: boolean
  reason?: string
}

type CompleteListener = (info: MoveCompleteInfo) => void
const completeListeners = new Set<CompleteListener>()

export function subscribeMoveComplete(listener: CompleteListener): () => void {
  completeListeners.add(listener)
  return () => completeListeners.delete(listener)
}

function notifyComplete(info: MoveCompleteInfo) {
  completeListeners.forEach((listener) => listener(info))
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
}

function applyJoints(q: JointVector) {
  const robot = getRobot()
  if (!robot) return
  JOINT_ORDER.forEach((name, i) => robot.setJointValue(name, q[i]))
}

function moveToDuration(dist: number, speed?: number): number {
  if (speed && speed > 0) return Math.max(0.15, dist / speed)
  return Math.max(0.4, (dist / 0.3) * 0.6)
}

function jointMoveDuration(maxDeltaRad: number): number {
  return Math.max(0.4, maxDeltaRad * 0.5)
}

/**
 * Lives inside the Canvas. Its useFrame loop is the single place that ever
 * writes joint values onto the rendered robot — every control mode (sliders,
 * joystick, keyboard, PIN sequencer) only ever emits MotionCommand objects.
 */
function MotionExecutor() {
  const jogAccumRef = useRef<Vec3>({ x: 0, y: 0, z: 0 })
  const pendingCommandRef = useRef<MotionCommand | null>(null)
  const motionStateRef = useRef<MotionState>({ kind: 'idle' })
  const lastJogToastRef = useRef(0)

  useEffect(
    () =>
      subscribe((command) => {
        if (command.type === 'JOG') {
          jogAccumRef.current.x += command.delta.x
          jogAccumRef.current.y += command.delta.y
          jogAccumRef.current.z += command.delta.z
        } else {
          pendingCommandRef.current = command
        }
      }),
    [],
  )

  useFrame(() => {
    const robot = getRobot()
    if (!robot) return

    // 1. Accept a new scripted command, interrupting any motion in progress.
    const pending = pendingCommandRef.current
    if (pending) {
      pendingCommandRef.current = null

      if (pending.type === 'MOVE_TO') {
        const startQ = currentJointVector()
        const startPos = fk(startQ)
        const gate = validate(pending.target, { currentQ: startQ, interpolated: true })
        if (!gate.ok) {
          telemetryRef.current.status = `rejected: ${gate.reason}`
          pushToast(gate.reason ?? 'Move rejected.', 'error')
          notifyComplete({ ok: false, reason: gate.reason ?? undefined })
        } else {
          motionStateRef.current = {
            kind: 'moveTo',
            startPos,
            endPos: pending.target,
            startTime: performance.now(),
            duration: moveToDuration(distance(startPos, pending.target), pending.speed),
          }
          telemetryRef.current.status = 'moving'
        }
      } else if (pending.type === 'HOME') {
        const startQ = currentJointVector()
        const endQ: JointVector = JOINT_ORDER.map(() => 0)
        const maxDelta = Math.max(...startQ.map((q, i) => Math.abs(q - endQ[i])))
        motionStateRef.current = {
          kind: 'jointMove',
          startQ,
          endQ,
          startTime: performance.now(),
          duration: jointMoveDuration(maxDelta),
        }
        telemetryRef.current.status = 'moving'
      }
    }

    // 2. Advance any in-progress scripted motion.
    const motion = motionStateRef.current
    if (motion.kind === 'moveTo') {
      const t = Math.min(1, (performance.now() - motion.startTime) / (motion.duration * 1000))
      const eased = easeInOutCubic(t)
      const waypoint = lerpVec3(motion.startPos, motion.endPos, eased)
      const warmStart = currentJointVector()
      const result = solveIK(waypoint, warmStart, { maxIter: WARM_START_MAX_ITER })
      applyJoints(result.q)

      if (t >= 1) {
        motionStateRef.current = { kind: 'idle' }
        telemetryRef.current.status = 'idle'
        notifyComplete({ ok: true })
      }
      return
    }

    if (motion.kind === 'jointMove') {
      const t = Math.min(1, (performance.now() - motion.startTime) / (motion.duration * 1000))
      const eased = easeInOutCubic(t)
      const q = motion.startQ.map((qi, i) => qi + (motion.endQ[i] - qi) * eased)
      applyJoints(q)

      if (t >= 1) {
        motionStateRef.current = { kind: 'idle' }
        telemetryRef.current.status = 'idle'
        notifyComplete({ ok: true })
      }
      return
    }

    // 3. Idle: process any accumulated JOG delta.
    const jog = jogAccumRef.current
    if (jog.x !== 0 || jog.y !== 0 || jog.z !== 0) {
      const currentQ = currentJointVector()
      const basePos = fk(currentQ)
      const target: Vec3 = { x: basePos.x + jog.x, y: basePos.y + jog.y, z: basePos.z + jog.z }
      jogAccumRef.current = { x: 0, y: 0, z: 0 }

      const gate = validate(target, { currentQ, interpolated: false })
      if (gate.ok && gate.q) {
        applyJoints(gate.q)
        telemetryRef.current.status = 'jogging'
      } else {
        telemetryRef.current.status = `rejected: ${gate.reason}`
        const now = performance.now()
        if (now - lastJogToastRef.current > JOG_TOAST_THROTTLE_MS) {
          lastJogToastRef.current = now
          pushToast(gate.reason ?? 'Jog rejected.', 'error')
        }
      }
    } else if (telemetryRef.current.status !== 'idle') {
      telemetryRef.current.status = 'idle'
    }
  })

  return null
}

export default MotionExecutor
