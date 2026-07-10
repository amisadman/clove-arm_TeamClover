// controls/VoiceControl.tsx
import { useEffect, useRef, useState } from 'react'
import { emit } from '../pipeline/commandBus'
import { telemetryRef } from '../dashboard/telemetry'
import { fk } from '../kinematics/solverTwin'
import { JOINT_ORDER, FALLBACK_JOINT_LIMITS, type JointVector } from '../kinematics/jointOrder'
import { runPin, abortPin } from '../pipeline/pinSequencer'
import './VoiceControl.css'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Direction = 'up' | 'down' | 'left' | 'right' | 'forward' | 'back'

type Intent =
  | { action: 'move'; direction: Direction; amountCm: number }
  | { action: 'rotate_joint'; joint: number; degrees: number }
  | { action: 'home' }
  | { action: 'enter_pin'; pin: string }
  | { action: 'abort_pin' }
  | { action: 'sequence'; steps: Exclude<Intent, { action: 'sequence' }>[] }
  | { action: 'clarify'; message: string }
  | { action: 'reject'; message: string }

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

// ─────────────────────────────────────────────────────────────
// Fixed command matching (Phase 3 — instant, no API call)
// ─────────────────────────────────────────────────────────────

function normalizeTranscript(raw: string): string {
  return raw.replace(/°/g, ' degrees').replace(/\s+/g, ' ').trim()
}

function amountOrDefault(raw?: string, def = 5): number {
  return raw ? Number(raw) : def
}

const DIRECTION_PATTERNS: { re: RegExp; direction: Direction }[] = [
  { re: /move\s+up(?:\s+by)?(?:\s+(\d+))?/i, direction: 'up' },
  { re: /move\s+down(?:\s+by)?(?:\s+(\d+))?/i, direction: 'down' },
  { re: /move\s+left(?:\s+by)?(?:\s+(\d+))?/i, direction: 'left' },
  { re: /move\s+right(?:\s+by)?(?:\s+(\d+))?/i, direction: 'right' },
  { re: /move\s+forward(?:\s+by)?(?:\s+(\d+))?/i, direction: 'forward' },
  { re: /move\s+back(?:ward)?(?:\s+by)?(?:\s+(\d+))?/i, direction: 'back' },
]

const JOINT_ROTATE_PATTERN = /rotate\s+joint\s*(\d)(?:\s+by)?\s+(-?\d+)\s*(?:deg(?:rees)?)?/i
const HOME_PATTERN = /^\s*home\s*[.!]?\s*$/i
// "enter pin 142536", "press pin 142536", "type pin 142536"
const PIN_ENTER_PATTERN = /(?:enter|press|type)\s+pin\s+(\d{6})/i
const PIN_ABORT_PATTERN = /(?:abort|stop|cancel)\s+pin/i

function validatePinDigits(pin: string): string | null {
  if (pin.length !== 6) return `PIN must be exactly 6 digits (got ${pin.length}).`
  if (![...pin].every((c) => '123456'.includes(c))) return 'PIN digits must each be 1-6 — those are the only configured keys.'
  return null
}

function matchFixedCommand(rawText: string): Intent | null {
  const text = normalizeTranscript(rawText)

  if (HOME_PATTERN.test(text)) return { action: 'home' }
  if (PIN_ABORT_PATTERN.test(text)) return { action: 'abort_pin' }

  const pinMatch = text.match(PIN_ENTER_PATTERN)
  if (pinMatch) return { action: 'enter_pin', pin: pinMatch[1] }

  const jointMatch = text.match(JOINT_ROTATE_PATTERN)
  if (jointMatch) {
    return { action: 'rotate_joint', joint: Number(jointMatch[1]), degrees: Number(jointMatch[2]) }
  }

  for (const { re, direction } of DIRECTION_PATTERNS) {
    const m = text.match(re)
    if (m) return { action: 'move', direction, amountCm: amountOrDefault(m[1]) }
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// Groq agent (Phase 3B — free-form / conversational fallback)
// ─────────────────────────────────────────────────────────────

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

const SYSTEM_PROMPT = `You control a 6-DOF robotic arm with a fixed stylus tip.
Output ONLY JSON matching exactly one of these shapes — nothing else, no markdown, no prose:

{ "action": "move", "direction": "up"|"down"|"left"|"right"|"forward"|"back", "amountCm": number }
{ "action": "rotate_joint", "joint": 1-6, "degrees": number }
{ "action": "home" }
{ "action": "enter_pin", "pin": "six digit string, digits 1-6 only" }
{ "action": "abort_pin" }
{ "action": "sequence", "steps": [ /* array of the above, never nested sequences */ ] }
{ "action": "clarify", "message": "one short question" }
{ "action": "reject", "message": "one short reason" }

Rules:
- If a distance or degree amount is missing, pick a small sensible default (5cm / 15 degrees) and just proceed — don't ask for it.
- For "enter_pin", the pin must be exactly 6 digits, each 1-6. If the spoken PIN doesn't fit that, use "reject" and explain why.
- If the instruction is genuinely ambiguous (no direction, no clear target, or an incomplete PIN), use "clarify" with ONE short question.
- If it asks for something this arm can't do (gripping, painting, anything outside move/rotate/home/pin entry), use "reject" with a brief reason.
- For multi-step instructions, use "sequence" with an ordered "steps" array.
- Never output anything except the JSON object.`

function newConversation(): ChatMessage[] {
  return [{ role: 'system', content: SYSTEM_PROMPT }]
}

async function sendToAgent(
  history: ChatMessage[],
  userText: string,
): Promise<{ intent: Intent; updatedHistory: ChatMessage[] }> {
  const messages = [...history, { role: 'user', content: userText } as ChatMessage]

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      return {
        intent: { action: 'reject', message: `Agent request failed (status ${res.status}).` },
        updatedHistory: history,
      }
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? ''
    let intent: Intent
    try {
      intent = JSON.parse(raw)
    } catch {
      return { intent: { action: 'reject', message: 'Agent returned malformed output.' }, updatedHistory: history }
    }

    const updatedHistory = [...messages, { role: 'assistant', content: raw } as ChatMessage]
    return { intent, updatedHistory }
  } catch (err) {
    console.error('Groq agent error:', err)
    return {
      intent: { action: 'reject', message: 'Could not reach the reasoning layer — check your connection or API key.' },
      updatedHistory: history,
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Safety-gated executor — the ONE place that ever calls emit()
// ─────────────────────────────────────────────────────────────

function currentJointVector(): JointVector {
  return JOINT_ORDER.map((name) => telemetryRef.current.jointAngles[name] ?? 0)
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value))
}

const DIRECTION_DELTA: Record<Direction, (m: number) => { x: number; y: number; z: number }> = {
  up: (m) => ({ x: 0, y: 0, z: m }),
  down: (m) => ({ x: 0, y: 0, z: -m }),
  left: (m) => ({ x: 0, y: m, z: 0 }),
  right: (m) => ({ x: 0, y: -m, z: 0 }),
  forward: (m) => ({ x: m, y: 0, z: 0 }),
  back: (m) => ({ x: -m, y: 0, z: 0 }),
}

/** Handles every action EXCEPT enter_pin/abort_pin, which are async and
 * handled separately in the component (runPin has progress callbacks that
 * don't fit this synchronous return shape). */
function applyIntent(intent: Intent): { ok: boolean; message: string } {
  switch (intent.action) {
    case 'home':
      emit({ type: 'HOME' })
      return { ok: true, message: 'Homing.' }

    case 'move': {
      const delta = DIRECTION_DELTA[intent.direction](intent.amountCm / 100)
      emit({ type: 'JOG', delta })
      return { ok: true, message: `Moving ${intent.direction} ${intent.amountCm}cm.` }
    }

    case 'rotate_joint': {
      const jointIndex = intent.joint - 1
      if (jointIndex < 0 || jointIndex > 5) {
        return { ok: false, message: `No such joint: ${intent.joint} (valid: 1-6)` }
      }
      const q = currentJointVector()
      const jointName = JOINT_ORDER[jointIndex]
      const limits = FALLBACK_JOINT_LIMITS[jointName]
      const deltaRad = (intent.degrees * Math.PI) / 180
      const rawAngle = q[jointIndex] + deltaRad
      const newAngle = clamp(rawAngle, limits.lower, limits.upper)
      const jointClamped = newAngle !== rawAngle

      const nextQ = q.slice()
      nextQ[jointIndex] = newAngle
      emit({ type: 'MOVE_TO', target: fk(nextQ) })

      return {
        ok: true,
        message: jointClamped
          ? `Rotating joint ${intent.joint} by ${intent.degrees} degrees, clamped to its limit.`
          : `Rotating joint ${intent.joint} by ${intent.degrees} degrees.`,
      }
    }

    case 'sequence': {
      for (const step of intent.steps) {
        if (step.action === 'enter_pin' || step.action === 'abort_pin') {
          return { ok: false, message: 'PIN entry cannot be part of a multi-step sequence — say it on its own.' }
        }
        const result = applyIntent(step)
        if (!result.ok) return result
      }
      return { ok: true, message: `Executed ${intent.steps.length}-step sequence.` }
    }

    case 'enter_pin':
    case 'abort_pin':
      // handled in the component, never reaches here
      return { ok: false, message: 'Internal: PIN action routed incorrectly.' }

    case 'clarify':
    case 'reject':
      return { ok: false, message: intent.message }
  }
}

// ─────────────────────────────────────────────────────────────
// Speech
// ─────────────────────────────────────────────────────────────

function speak(text: string) {
  window.speechSynthesis.cancel() // don't let responses queue/overlap
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

function VoiceControl() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('Mic off')
  const [thinking, setThinking] = useState(false)

  const recognitionRef = useRef<any>(null)
  const conversationRef = useRef<ChatMessage[] | null>(null) // null = no pending clarification
  const pinRunningRef = useRef(false) // guards against overlapping voice-triggered PIN runs

  const runPinFromVoice = (pin: string) => {
    const validationError = validatePinDigits(pin)
    if (validationError) {
      setStatus(validationError)
      speak(validationError)
      return
    }
    if (pinRunningRef.current) {
      const msg = 'A PIN entry is already running — say "abort pin" first.'
      setStatus(msg)
      speak(msg)
      return
    }

    pinRunningRef.current = true
    setStatus(`Entering PIN ${pin}…`)
    speak(`Entering PIN.`)

    runPin(pin, {
      onDigitState: (index, state) => {
        setStatus(`PIN digit ${index + 1}/${pin.length}: ${state}`)
      },
      onDigitResult: (index, result) => {
        if (!result.ok) {
          setStatus(`Digit ${index + 1} missed: ${result.errorMm.toFixed(1)}mm`)
        }
      },
      onAbort: (reason) => {
        pinRunningRef.current = false
        setStatus(`PIN aborted: ${reason}`)
        speak(`PIN entry stopped. ${reason}`)
      },
      onComplete: () => {
        pinRunningRef.current = false
        setStatus(`PIN ${pin} entry complete.`)
        speak('PIN entry complete.')
      },
    })
  }

  const handlePinAbort = () => {
    if (!pinRunningRef.current) {
      const msg = 'No PIN entry is currently running.'
      setStatus(msg)
      speak(msg)
      return
    }
    abortPin()
    setStatus('Aborting PIN entry…')
  }

  const handleIntent = (intent: Intent, history: ChatMessage[]) => {
    if (intent.action === 'clarify') {
      conversationRef.current = history // keep the conversation open
      setStatus(`Agent: ${intent.message}`)
      speak(intent.message)
      return
    }

    conversationRef.current = null // any other outcome ends the conversation

    if (intent.action === 'enter_pin') {
      runPinFromVoice(intent.pin)
      return
    }
    if (intent.action === 'abort_pin') {
      handlePinAbort()
      return
    }

    const result = applyIntent(intent)
    setStatus(result.message)
    speak(result.message)
  }

  const handleUtterance = async (rawText: string) => {
    setTranscript(rawText)

    // Mid-clarification: this utterance is the answer, always goes to the agent.
    if (conversationRef.current) {
      setThinking(true)
      const { intent, updatedHistory } = await sendToAgent(conversationRef.current, rawText)
      setThinking(false)
      handleIntent(intent, updatedHistory)
      return
    }

    // Fresh utterance: try the fixed vocabulary first (fast, no API call).
    const fixed = matchFixedCommand(rawText)
    if (fixed) {
      if (fixed.action === 'enter_pin') {
        runPinFromVoice(fixed.pin)
        return
      }
      if (fixed.action === 'abort_pin') {
        handlePinAbort()
        return
      }
      const result = applyIntent(fixed)
      setStatus(result.message)
      speak(result.message)
      return
    }

    // No fixed match — start a new agent conversation.
    setThinking(true)
    const { intent, updatedHistory } = await sendToAgent(newConversation(), rawText)
    setThinking(false)
    handleIntent(intent, updatedHistory)
  }

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
      handleUtterance(rawText)
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
        <span className="voice-status-text">{thinking ? 'Thinking…' : status}</span>
      </div>
    </div>
  )
}

export default VoiceControl