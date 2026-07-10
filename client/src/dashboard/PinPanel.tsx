import { useRef, useState } from 'react'
import { runPin, abortPin, type PinDigitResult, type PinStepState } from '../pipeline/pinSequencer'
import './PinPanel.css'

interface DigitDisplay {
  digit: string
  state: PinStepState
  result?: PinDigitResult
}

function validatePin(pin: string): string | null {
  if (pin.length === 0) return null
  if (pin.length !== 6) return `PIN must be exactly 6 digits (got ${pin.length}).`
  if (![...pin].every((c) => '123456'.includes(c))) return 'PIN digits must each be 1-6 — those are the only configured keys.'
  return null
}

function PinPanel() {
  const [pin, setPin] = useState('')
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [digits, setDigits] = useState<DigitDisplay[]>([])
  const runIdRef = useRef(0)

  const validationError = validatePin(pin)
  const canStart = !running && pin.length > 0 && validationError === null

  const handleStart = () => {
    if (!canStart) return
    setRunError(null)
    setRunning(true)
    const runId = ++runIdRef.current
    setDigits([...pin].map((digit) => ({ digit, state: 'pending' })))

    runPin(pin, {
      onDigitState: (index, state) => {
        if (runIdRef.current !== runId) return
        setDigits((prev) => prev.map((d, i) => (i === index ? { ...d, state } : d)))
      },
      onDigitResult: (index, result) => {
        if (runIdRef.current !== runId) return
        setDigits((prev) => prev.map((d, i) => (i === index ? { ...d, result } : d)))
      },
      onAbort: (reason) => {
        if (runIdRef.current !== runId) return
        setRunError(reason)
      },
      onComplete: () => {
        if (runIdRef.current !== runId) return
        setRunning(false)
      },
    })
  }

  const handleAbort = () => abortPin()

  return (
    <div className="pin-panel">
      <h2>Autonomous PIN Entry</h2>
      <div className="pin-input-row">
        <input
          type="text"
          value={pin}
          placeholder="e.g. 142536"
          disabled={running}
          onChange={(event) => setPin(event.target.value.trim())}
        />
        <button type="button" onClick={handleStart} disabled={!canStart}>
          Start
        </button>
        <button type="button" onClick={handleAbort} disabled={!running}>
          Abort
        </button>
      </div>
      {(validationError ?? runError) && <div className="pin-error">{validationError ?? runError}</div>}
      {digits.length > 0 && (
        <div className="pin-progress">
          {digits.map((d, i) => {
            const failed = d.result ? !d.result.ok : false
            const className = `pin-digit pin-digit-${d.state}${failed ? ' pin-digit-failed' : ''}`
            return (
              <div key={i} className={className}>
                <span className="pin-digit-label">{d.digit}</span>
                <span className="pin-digit-status">
                  {d.result
                    ? `${d.result.ok ? '✓' : '✗'} ${d.result.errorMm.toFixed(1)}mm`
                    : d.state}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PinPanel
