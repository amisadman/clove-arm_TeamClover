import { getKeyConfig } from '../sim/keyConfig'
import { telemetryRef } from '../dashboard/telemetry'
import { flashKey } from '../sim/keyFlash'
import { emit } from './commandBus'
import { subscribeMoveComplete, type MoveCompleteInfo } from './motionExecutor'
import type { Vec3 } from '../kinematics/types'

const HOVER_OFFSET_M = 0.06
const DESCEND_SPEED_M_S = 0.05
const CHECK_TOLERANCE_MM = 5

export type PinStepState = 'pending' | 'hover' | 'descend' | 'check' | 'retract' | 'done'

export interface PinDigitResult {
  digit: string
  errorMm: number
  ok: boolean
  t: number
}

export interface PinRunCallbacks {
  onDigitState?: (index: number, state: PinStepState) => void
  onDigitResult?: (index: number, result: PinDigitResult) => void
  onAbort?: (reason: string) => void
  onComplete?: () => void
}

interface AbortState {
  requested: boolean
}

let activeAbort: AbortState | null = null

function moveToAndWait(target: Vec3, speed?: number): Promise<MoveCompleteInfo> {
  return new Promise((resolve) => {
    const unsubscribe = subscribeMoveComplete((info) => {
      unsubscribe()
      resolve(info)
    })
    emit({ type: 'MOVE_TO', target, speed })
  })
}

/** Requests the currently running PIN sequence to stop after its current leg. */
export function abortPin() {
  if (activeAbort) activeAbort.requested = true
}

/**
 * Drives the executor through HOVER -> DESCEND -> CHECK -> RETRACT for each
 * digit, purely via MOVE_TO commands and their completion events — the same
 * pipeline every other control mode uses. Never continues past a gate
 * rejection or a failed tolerance check.
 */
export async function runPin(pin: string, callbacks: PinRunCallbacks = {}): Promise<void> {
  const keys = getKeyConfig()?.keys
  if (!keys) {
    callbacks.onAbort?.('Key config not loaded yet.')
    callbacks.onComplete?.()
    return
  }

  const abortState: AbortState = { requested: false }
  activeAbort = abortState

  for (let i = 0; i < pin.length; i++) {
    if (abortState.requested) break

    const digit = pin[i]
    const key = keys[digit]
    if (!key) {
      callbacks.onAbort?.(`No key configured for digit "${digit}".`)
      break
    }

    const hoverTarget: Vec3 = { x: key.x, y: key.y, z: key.z + HOVER_OFFSET_M }
    const pressTarget: Vec3 = { x: key.x, y: key.y, z: key.z }

    callbacks.onDigitState?.(i, 'hover')
    const hoverResult = await moveToAndWait(hoverTarget)
    if (!hoverResult.ok) {
      callbacks.onAbort?.(hoverResult.reason ?? 'Hover move rejected.')
      break
    }
    if (abortState.requested) break

    callbacks.onDigitState?.(i, 'descend')
    const descendResult = await moveToAndWait(pressTarget, DESCEND_SPEED_M_S)
    if (!descendResult.ok) {
      callbacks.onAbort?.(descendResult.reason ?? 'Descend move rejected.')
      break
    }
    if (abortState.requested) {
      await moveToAndWait(hoverTarget) // retreat to a safe hover before stopping
      break
    }

    callbacks.onDigitState?.(i, 'check')
    const tip = telemetryRef.current.tcp
    const errorMm = Math.hypot(tip.x - key.x, tip.y - key.y, tip.z - key.z) * 1000
    const ok = errorMm <= CHECK_TOLERANCE_MM
    flashKey(digit, ok ? 'success' : 'error')
    callbacks.onDigitResult?.(i, { digit, errorMm, ok, t: Date.now() })

    if (!ok) {
      callbacks.onAbort?.(`Key "${digit}" missed tolerance: ${errorMm.toFixed(2)} mm (max ${CHECK_TOLERANCE_MM} mm).`)
      await moveToAndWait(hoverTarget)
      break
    }

    callbacks.onDigitState?.(i, 'retract')
    await moveToAndWait(hoverTarget)
    callbacks.onDigitState?.(i, 'done')
    if (abortState.requested) break
  }

  activeAbort = null
  callbacks.onComplete?.()
}
