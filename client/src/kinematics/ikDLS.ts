import { fk, clampToLimits } from './solverTwin'
import { computeJacobian } from './jacobian'
import { JOINT_ORDER, type JointVector } from './jointOrder'
import type { Vec3 } from './types'

// maxStep (0.05 m) and lambda (0.08) are tuned for stability near singularities
// per the plan. maxIter=30 (the plan's suggested default) is too tight for a
// cold start from the home pose to a far target: distance/maxStep alone needs
// ~31 iterations for the worst case in this arm's reachable shell. 80 clears
// that with margin (verified: 200/200 random targets converge <1mm by
// iteration ~63) and is cheap since it only runs for cold starts — warm-started
// JOG/MOVE_TO calls override this down to a few iterations.
const MAX_ITER = 80
const TOLERANCE_M = 1e-3 // 1 mm
const MAX_STEP_M = 0.05
const LAMBDA = 0.08

export interface IKResult {
  success: boolean
  q: JointVector
  errorMm: number
  iterations: number
}

/** Closed-form 3x3 inverse (cofactor/adjugate method), no math library. */
function invert3x3(m: number[][]): number[][] | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (Math.abs(det) < 1e-12) return null

  const invDet = 1 / det
  return [
    [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ]
}

export function solveIK(target: Vec3, qStart: JointVector, opts: { maxIter?: number } = {}): IKResult {
  const maxIter = opts.maxIter ?? MAX_ITER
  let q = qStart.slice()
  let iterations = 0

  for (; iterations < maxIter; iterations++) {
    const p = fk(q)
    const ex = target.x - p.x
    const ey = target.y - p.y
    const ez = target.z - p.z
    const errNorm = Math.sqrt(ex * ex + ey * ey + ez * ez)

    if (errNorm < TOLERANCE_M) {
      return { success: true, q, errorMm: errNorm * 1000, iterations }
    }

    // Clamp step magnitude, preserving direction, so far targets don't cause wild jumps.
    const scale = errNorm > MAX_STEP_M ? MAX_STEP_M / errNorm : 1
    const e = [ex * scale, ey * scale, ez * scale]

    const J = computeJacobian(q) // 3x7

    // M = J J^T + lambda^2 I3
    const M: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        let sum = 0
        for (let k = 0; k < JOINT_ORDER.length; k++) sum += J[a][k] * J[b][k]
        M[a][b] = sum + (a === b ? LAMBDA * LAMBDA : 0)
      }
    }

    const Minv = invert3x3(M)
    if (!Minv) break // singular — stop and report the best pose found so far

    // w = Minv * e (3-vector)
    const w = [0, 1, 2].map((a) => Minv[a][0] * e[0] + Minv[a][1] * e[1] + Minv[a][2] * e[2])

    // dq = J^T * w (7-vector)
    const dq = JOINT_ORDER.map((_, i) => J[0][i] * w[0] + J[1][i] * w[1] + J[2][i] * w[2])

    q = clampToLimits(q.map((qi, i) => qi + dq[i]))
  }

  const finalError = fk(q)
  const errorMm =
    Math.sqrt((target.x - finalError.x) ** 2 + (target.y - finalError.y) ** 2 + (target.z - finalError.z) ** 2) * 1000

  return { success: errorMm < TOLERANCE_M * 1000, q, errorMm, iterations }
}

const J2_BASE_POSITION: Vec3 = { x: 0, y: 0, z: 0.31 }

export interface SelfTestSample {
  target: Vec3
  result: IKResult
}

export interface SelfTestSummary {
  total: number
  successCount: number
  maxErrorMm: number
  samples: SelfTestSample[]
}

/** Samples random targets in a reachable shell around J2 and solves IK from home. */
export function runIkSelfTest(sampleCount = 25): SelfTestSummary {
  const homeQ: JointVector = JOINT_ORDER.map(() => 0)
  const samples: SelfTestSample[] = []
  let successCount = 0
  let maxErrorMm = 0

  for (let n = 0; n < sampleCount; n++) {
    const radius = 0.25 + Math.random() * (1.0 - 0.25)
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)

    const target: Vec3 = {
      x: J2_BASE_POSITION.x + radius * Math.sin(phi) * Math.cos(theta),
      y: J2_BASE_POSITION.y + radius * Math.sin(phi) * Math.sin(theta),
      z: Math.min(1.2, Math.max(0.05, J2_BASE_POSITION.z + radius * Math.cos(phi))),
    }

    const result = solveIK(target, homeQ)
    samples.push({ target, result })
    if (result.success) successCount++
    maxErrorMm = Math.max(maxErrorMm, result.errorMm)
  }

  return { total: sampleCount, successCount, maxErrorMm, samples }
}
