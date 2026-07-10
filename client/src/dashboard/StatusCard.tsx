import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { telemetryRef } from './telemetry'
import './StatusCard.css'

type StatusTone = 'idle' | 'active' | 'rejected'

function classify(status: string): StatusTone {
  if (status.startsWith('rejected')) return 'rejected'
  if (status === 'idle') return 'idle'
  return 'active'
}

const ICONS: Record<StatusTone, ReactElement> = {
  idle: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  active: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  ),
  rejected: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path
        d="M12 8v5M12 16h.01M10.3 3.8 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

function StatusCard() {
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    const id = setInterval(() => {
      setStatus(telemetryRef.current.status)
    }, 100)
    return () => clearInterval(id)
  }, [])

  const tone = classify(status)

  return (
    <div className={`status-card status-card-${tone}`} title={status}>
      <span className="status-card-icon">{ICONS[tone]}</span>
    </div>
  )
}

export default StatusCard
