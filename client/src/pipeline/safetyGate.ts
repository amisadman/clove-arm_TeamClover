import { solveIK } from '../kinematics/ikDLS'
import { jointLimits } from '../kinematics/solverTwin'
import { subscribeRobot } from '../sim/robotStore'
import { getKeyConfig } from '../sim/keyConfig'
import { JOINT_ORDER, type JointVector } from '../kinematics/jointOrder'
import type { Vec3 } from '../kinematics/types'

const FLOOR_Z = 0.0
const MAX_RADIUS_M = 1.45
const BOUNDS = { minX: -1.5, maxX: 1.5, minY: -1.5, maxY: 1.5, maxZ: 1.6 }
const MAX_REACH_ERROR_MM = 5
const MAX_JOINT_STEP_RAD = 1.5

export interface SafetyContext {
  currentQ: JointVector
  /**
   * True when the caller (the MOVE_TO executor) guarantees the resulting
   * joint motion will be smoothly interpolated over time rather than applied
   * in a single uninterpolated step. The rate-limit check (#4) exists to
   * catch raw, un-interpolated snaps — e.g. a bad JOG delta — not legitimate
   * far MOVE_TO destinations, which by design require large joint travel and
   * are always interpolated by the executor before reaching the robot.
   */
  interpolated?: boolean
}

export interface SafetyResult {
  ok: boolean
  reason: string | null
  q?: JointVector
  errorMm?: number
}

export function validate(target: Vec3, context: SafetyContext): SafetyResult {
  // 1. Workspace bounds
  if (target.z < FLOOR_Z) {
    return { ok: false, reason: `Target z=${target.z.toFixed(3)} m is below the floor (must be >= ${FLOOR_Z} m).` }
  }
  const radius = Math.hypot(target.x, target.y)
  if (radius > MAX_RADIUS_M) {
    return {
      ok: false,
      reason: `Target radius ${radius.toFixed(3)} m exceeds the ${MAX_RADIUS_M} m workspace limit.`,
    }
  }
  if (
    target.x < BOUNDS.minX ||
    target.x > BOUNDS.maxX ||
    target.y < BOUNDS.minY ||
    target.y > BOUNDS.maxY ||
    target.z > BOUNDS.maxZ
  ) {
    return { ok: false, reason: 'Target lies outside the arm\'s bounding box.' }
  }

  // 2. Reachability
  const result = solveIK(target, context.currentQ)
  if (!result.success || result.errorMm > MAX_REACH_ERROR_MM) {
    return {
      ok: false,
      reason: `Target unreachable — IK error ${result.errorMm.toFixed(1)} mm exceeds the ${MAX_REACH_ERROR_MM} mm tolerance.`,
    }
  }

  // 3. Joint limits — defense in depth. The solver clamps every iteration, so
  // this should always pass; asserted separately so a future solver change
  // can't silently ship a limit-violating solution.
  for (let i = 0; i < JOINT_ORDER.length; i++) {
    const { lower, upper } = jointLimits(JOINT_ORDER[i])
    if (result.q[i] < lower - 1e-6 || result.q[i] > upper + 1e-6) {
      return { ok: false, reason: `Solved ${JOINT_ORDER[i]} angle violates its joint limit.` }
    }
  }

  // 4. Rate limit (uninterpolated moves only — see SafetyContext.interpolated)
  if (!context.interpolated) {
    for (let i = 0; i < JOINT_ORDER.length; i++) {
      const step = Math.abs(result.q[i] - context.currentQ[i])
      if (step > MAX_JOINT_STEP_RAD) {
        return {
          ok: false,
          reason: `${JOINT_ORDER[i]} would jump ${step.toFixed(2)} rad in one uninterpolated step (max ${MAX_JOINT_STEP_RAD} rad).`,
        }
      }
    }
  }

  return { ok: true, reason: null, q: result.q, errorMm: result.errorMm }
}

if (import.meta.env.DEV) {
  subscribeRobot(() => {
    const homeQ: JointVector = JOINT_ORDER.map(() => 0)
    const outOfReach = validate({ x: 2, y: 0, z: 0.05 }, { currentQ: homeQ })
    const belowFloor = validate({ x: 0.5, y: 0.05, z: -0.2 }, { currentQ: homeQ })
    const key1 = getKeyConfig()?.keys['1'] ?? { x: 0.5, y: 0.05, z: 0.05 }
    const key1Result = validate(key1, { currentQ: homeQ })

    console.log('[safetyGate] (2, 0, 0.05) out of reach ->', outOfReach.ok, outOfReach.reason)
    console.log('[safetyGate] (0.5, 0.05, -0.2) below floor ->', belowFloor.ok, belowFloor.reason)
    console.log('[safetyGate] key "1" ->', key1Result.ok, key1Result.errorMm?.toFixed(2), 'mm')
  })
}
