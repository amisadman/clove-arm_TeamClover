import { useEffect, useRef, useState } from 'react'
import { emit } from '../pipeline/commandBus'

const MAX_SPEED_M_S = 0.15
const FINE_SCALE = 0.25

interface Axis {
  dx: number
  dy: number
  dz: number
}

// W/S = +X/-X, A/D = +Y/-Y, Q/E = +Z/-Z (base frame). Arrow keys mirror WASD.
const KEY_AXIS: Record<string, Axis> = {
  w: { dx: 1, dy: 0, dz: 0 },
  arrowup: { dx: 1, dy: 0, dz: 0 },
  s: { dx: -1, dy: 0, dz: 0 },
  arrowdown: { dx: -1, dy: 0, dz: 0 },
  a: { dx: 0, dy: 1, dz: 0 },
  arrowleft: { dx: 0, dy: 1, dz: 0 },
  d: { dx: 0, dy: -1, dz: 0 },
  arrowright: { dx: 0, dy: -1, dz: 0 },
  q: { dx: 0, dy: 0, dz: 1 },
  e: { dx: 0, dy: 0, dz: -1 },
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useKeyboard() {
  const [fine, setFine] = useState(false)
  const [legendVisible, setLegendVisible] = useState(false)

  const heldRef = useRef<Set<string>>(new Set())
  const fineRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = (time: number) => {
      const last = lastTimeRef.current
      lastTimeRef.current = time
      const dt = last === null ? 0 : Math.min(0.05, (time - last) / 1000)
      const scale = (fineRef.current ? FINE_SCALE : 1) * MAX_SPEED_M_S

      let dx = 0
      let dy = 0
      let dz = 0
      heldRef.current.forEach((key) => {
        const axis = KEY_AXIS[key]
        if (axis) {
          dx += axis.dx
          dy += axis.dy
          dz += axis.dz
        }
      })

      if (dt > 0 && (dx !== 0 || dy !== 0 || dz !== 0)) {
        emit({ type: 'JOG', delta: { x: dx * scale * dt, y: dy * scale * dt, z: dz * scale * dt } })
      }

      if (heldRef.current.size > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
        lastTimeRef.current = null
      }
    }

    const ensureLoop = () => {
      if (rafRef.current === null) {
        lastTimeRef.current = null
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()

      if (key === 'shift') {
        fineRef.current = true
        setFine(true)
        return
      }
      if (key === 'h') {
        emit({ type: 'HOME' })
        return
      }
      if (key === '?') {
        setLegendVisible((visible) => !visible)
        return
      }
      if (KEY_AXIS[key]) {
        event.preventDefault()
        heldRef.current.add(key)
        ensureLoop()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'shift') {
        fineRef.current = false
        setFine(false)
        return
      }
      heldRef.current.delete(key)
    }

    const handleBlur = () => {
      heldRef.current.clear()
      fineRef.current = false
      setFine(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { fine, legendVisible, setLegendVisible }
}
