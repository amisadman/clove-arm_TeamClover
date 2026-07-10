import { fk } from './solverTwin'
import { JOINT_ORDER, type JointVector } from './jointOrder'

const H = 1e-4

/** 3x7 numeric Jacobian: row 0/1/2 = d(x/y/z)/dq, one column per joint. */
export type Jacobian3x7 = number[][]

export function computeJacobian(q: JointVector): Jacobian3x7 {
  const base = fk(q)
  const J: Jacobian3x7 = [[], [], []]

  for (let i = 0; i < JOINT_ORDER.length; i++) {
    const qh = q.slice()
    qh[i] += H
    const p = fk(qh)
    J[0].push((p.x - base.x) / H) //
    J[1].push((p.y - base.y) / H)
    J[2].push((p.z - base.z) / H)
  }

  return J
}
