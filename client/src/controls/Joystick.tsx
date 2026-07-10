import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { emit } from '../pipeline/commandBus'
import { telemetryRef } from '../dashboard/telemetry'
import './Joystick.css'

const MAX_SPEED_M_S = 0.15
const FINE_SCALE = 0.25
const PAD_RADIUS_PX = 44

function Joystick() {
  const padRef = useRef<HTMLDivElement>(null)
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 })
  const [fine, setFine] = useState(false)

  const knobOffsetRef = useRef(knobOffset)
  knobOffsetRef.current = knobOffset
  const draggingRef = useRef(false)
  const zDirRef = useRef<0 | 1 | -1>(0)
  const fineRef = useRef(fine)
  fineRef.current = fine

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  const tick = (time: number) => {
    const last = lastTimeRef.current
    lastTimeRef.current = time
    const dt = last === null ? 0 : Math.min(0.05, (time - last) / 1000)

    const scale = (fineRef.current ? FINE_SCALE : 1) * MAX_SPEED_M_S
    let dx = 0
    let dy = 0
    let dz = 0

    if (draggingRef.current) {
      const { x, y } = knobOffsetRef.current
      dx = x * scale * dt
      dy = -y * scale * dt // screen y grows downward; pad "up" jogs +Y
    }
    if (zDirRef.current !== 0) {
      dz = zDirRef.current * scale * dt
    }

    if (dt > 0 && (dx !== 0 || dy !== 0 || dz !== 0)) {
      emit({ type: 'JOG', delta: { x: dx, y: dy, z: dz } })
    }

    padRef.current?.classList.toggle('joystick-pad-rejected', telemetryRef.current.status.startsWith('rejected'))

    if (draggingRef.current || zDirRef.current !== 0) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      rafRef.current = null
      lastTimeRef.current = null
      padRef.current?.classList.remove('joystick-pad-rejected')
    }
  }

  const ensureLoop = () => {
    if (rafRef.current === null) {
      lastTimeRef.current = null
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const updateKnobFromPointer = (clientX: number, clientY: number) => {
    const pad = padRef.current
    if (!pad) return
    const rect = pad.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let ox = clientX - cx
    let oy = clientY - cy
    const dist = Math.hypot(ox, oy)
    if (dist > PAD_RADIUS_PX) {
      ox = (ox / dist) * PAD_RADIUS_PX
      oy = (oy / dist) * PAD_RADIUS_PX
    }
    setKnobOffset({ x: ox / PAD_RADIUS_PX, y: oy / PAD_RADIUS_PX })
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    updateKnobFromPointer(event.clientX, event.clientY)
    ensureLoop()
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    updateKnobFromPointer(event.clientX, event.clientY)
  }

  const handlePointerUp = () => {
    draggingRef.current = false
    setKnobOffset({ x: 0, y: 0 })
  }

  const startZ = (dir: 1 | -1) => {
    zDirRef.current = dir
    ensureLoop()
  }
  const stopZ = () => {
    zDirRef.current = 0
  }

  return (
    <div className="joystick">
      <div
        className="joystick-pad"
        ref={padRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="joystick-knob"
          style={{
            transform: `translate(${knobOffset.x * PAD_RADIUS_PX}px, ${knobOffset.y * PAD_RADIUS_PX}px)`,
          }}
        />
      </div>
      <div className="joystick-z-controls">
        <button
          type="button"
          onPointerDown={() => startZ(1)}
          onPointerUp={stopZ}
          onPointerLeave={stopZ}
          onPointerCancel={stopZ}
        >
          +Z
        </button>
        <button
          type="button"
          onPointerDown={() => startZ(-1)}
          onPointerUp={stopZ}
          onPointerLeave={stopZ}
          onPointerCancel={stopZ}
        >
          −Z
        </button>
      </div>
      <label className="joystick-fine">
        <input type="checkbox" checked={fine} onChange={(event) => setFine(event.target.checked)} />
        Fine
      </label>
    </div>
  )
}

export default Joystick
