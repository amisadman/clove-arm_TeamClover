import { useEffect, useState } from 'react'
import { telemetryRef } from './telemetry'
import './CoordinateCard.css'

function CoordinateCard() {
  const [tcp, setTcp] = useState({ x: 0, y: 0, z: 0 })

  useEffect(() => {
    const id = setInterval(() => {
      setTcp({ ...telemetryRef.current.tcp })
    }, 100)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="coordinate-card">
      <div className="coordinate-row">
        <span className="coordinate-label">X</span>
        <span className="coordinate-value">{tcp.x.toFixed(3)}</span>
      </div>
      <div className="coordinate-row">
        <span className="coordinate-label">Y</span>
        <span className="coordinate-value">{tcp.y.toFixed(3)}</span>
      </div>
      <div className="coordinate-row">
        <span className="coordinate-label">Z</span>
        <span className="coordinate-value">{tcp.z.toFixed(3)}</span>
      </div>
    </div>
  )
}

export default CoordinateCard
