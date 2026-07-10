// controls/VoiceControl.tsx
import { useEffect, useRef, useState } from 'react'
import { emit } from '../pipeline/commandBus'
import { telemetryRef } from '../dashboard/telemetry'
import { fk } from '../kinematics/solverTwin'
import { JOINT_ORDER, FALLBACK_JOINT_LIMITS, type JointVector } from '../kinematics/jointOrder'
import './VoiceControl.css'

const JOG_STEP_M = 0.05 // default nudge distance when no amount is spoken

function cm(raw?: string) {
  return raw ? Number(raw) / 100 : JOG_STEP_M
}

function normalizeTranscript(raw: string): string {
  return raw
    .replace(/°/g, ' degrees')
    .replace(/\s+/g, ' ')
    .trim()
}

function currentJointVector(): JointVector {
  return JOINT_ORDER.map((name) => telemetryRef.current.jointAngles[name] ?? 0)
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value))
}

/** Rotates one named joint by `degrees` from its current angle, clamps to its
 * URDF limit, runs forward kinematics on the resulting pose, and returns the
 * TCP target — this is the real fix, not a cartesian approximation. */
function computeJointRotationTarget(jointIndex: number, degrees: number) {
  const q = currentJointVector()
  const jointName = JOINT_ORDER[jointIndex]
  const deltaRad = (degrees * Math.PI) / 180
  const limits = FALLBACK_JOINT_LIMITS[jointName]

  const newAngle = clamp(q[jointIndex] + deltaRad, limits.lower, limits.upper)
  const clamped = newAngle !== q[jointIndex] + deltaRad

  const nextQ = q.slice()
  nextQ[jointIndex] = newAngle

  return { target: fk(nextQ), clamped }
}

const JOG_PATTERNS: { re: RegExp; toDelta: (m: RegExpMatchArray) => { x: number; y: number; z: number } }[] = [
  { re: /move\s+up(?:\s+by)?(?:\s+(\d+))?/i,            toDelta: m => ({ x: 0, y: 0, z: cm(m[1]) }) },
  { re: /move\s+down(?:\s+by)?(?:\s+(\d+))?/i,          toDelta: m => ({ x: 0, y: 0, z: -cm(m[1]) }) },
  { re: /move\s+left(?:\s+by)?(?:\s+(\d+))?/i,          toDelta: m => ({ x: 0, y: cm(m[1]), z: 0 }) },
  { re: /move\s+right(?:\s+by)?(?:\s+(\d+))?/i,         toDelta: m => ({ x: 0, y: -cm(m[1]), z: 0 }) },
  { re: /move\s+forward(?:\s+by)?(?:\s+(\d+))?/i,       toDelta: m => ({ x: cm(m[1]), y: 0, z: 0 }) },
  { re: /move\s+back(?:ward)?(?:\s+by)?(?:\s+(\d+))?/i, toDelta: m => ({ x: -cm(m[1]), y: 0, z: 0 }) },
]

// "rotate joint 1 by 50", "rotate joint 3 -20 degrees", "rotate joint1 by 50 degrees"
const JOINT_ROTATE_PATTERN = /rotate\s+joint\s*(\d)(?:\s+by)?\s+(-?\d+)\s*(?:deg(?:rees)?)?/i
const HOME_PATTERN = /^\s*home\s*[.!]?\s*$/i

function VoiceControl() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('Mic off')

  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (!listening) {
      recognitionRef.current?.stop()
      return
    }

    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) {
      setStatus('Speech recognition not supported — use Chrome/Edge')
      setListening(false)
      return
    }

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const rawText = event.results[event.results.length - 1][0].transcript.trim()
      const text = normalizeTranscript(rawText)
      setTranscript(rawText)

      if (HOME_PATTERN.test(text)) {
        emit({ type: 'HOME' })
        setStatus(`Sent: ${text}`)
        return
      }

      const jointMatch = text.match(JOINT_ROTATE_PATTERN)
      if (jointMatch) {
        const jointNum = Number(jointMatch[1]) // 1-6
        const degrees = Number(jointMatch[2])
        const jointIndex = jointNum - 1

        if (jointIndex < 0 || jointIndex > 5) {
          setStatus(`No such joint: ${jointNum} (valid: 1-6)`)
          return
        }

        const { target, clamped } = computeJointRotationTarget(jointIndex, degrees)
        emit({ type: 'MOVE_TO', target })
        setStatus(clamped ? `Sent (clamped to limit): ${text}` : `Sent: ${text}`)
        return
      }

      const hit = JOG_PATTERNS.find(({ re }) => re.test(text))
      if (hit) {
        emit({ type: 'JOG', delta: hit.toDelta(text.match(hit.re)!) })
        setStatus(`Sent: ${text}`)
      } else {
        setStatus(`Didn't recognize: "${text}"`)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error)
      setStatus(`Error: ${event.error}`)
    }

    recognition.onend = () => {
      if (listening) recognition.start()
    }

    recognition.start()
    recognitionRef.current = recognition
    setStatus('Listening…')

    return () => {
      recognition.onend = null
      recognition.stop()
    }
  }, [listening])

  return (
    <div className="voice-control">
      <button
        type="button"
        className={`voice-toggle ${listening ? 'voice-toggle-active' : ''}`}
        onClick={() => setListening((v) => !v)}
      >
        {listening ? ' Listening' : ' Start Voice'}
      </button>
      <div className="voice-status">
        {transcript && <span className="voice-transcript">"{transcript}"</span>}
        <span className="voice-status-text">{status}</span>
      </div>
    </div>
  )
}

export default VoiceControl