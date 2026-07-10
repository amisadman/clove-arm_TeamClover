import { useState } from 'react'
import { runIkSelfTest, solveIK } from '../kinematics/ikDLS'
import { JOINT_ORDER } from '../kinematics/jointOrder'
import { getKeyConfig } from '../sim/keyConfig'
import { pushToast } from './toast'
import './IkSelfTest.css'

const KEY_1_FALLBACK = { x: 0.5, y: 0.05, z: 0.05 }

function runSelfTest() {
  const summary = runIkSelfTest(25)
  const key1 = getKeyConfig()?.keys['1'] ?? KEY_1_FALLBACK
  const homeQ = JOINT_ORDER.map(() => 0)
  const key1Result = solveIK(key1, homeQ)

  console.log(
    `[IK self-test] ${summary.successCount}/${summary.total} succeeded, max error ${summary.maxErrorMm.toFixed(3)} mm`,
    summary.samples,
  )
  console.log(
    `[IK self-test] key "1" (${key1.x}, ${key1.y}, ${key1.z}) -> ${key1Result.success ? 'success' : 'FAILED'}, error ${key1Result.errorMm.toFixed(3)} mm`,
  )

  const passed = summary.successCount >= 24 && key1Result.success
  pushToast(
    `IK self-test: ${summary.successCount}/${summary.total} ok, max err ${summary.maxErrorMm.toFixed(2)} mm, key 1 ${
      key1Result.success ? 'ok' : 'FAILED'
    }`,
    passed ? 'success' : 'error',
  )

  return summary
}

function IkSelfTest() {
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const handleClick = () => {
    setRunning(true)
    // Yield a frame so the "Running…" label paints before the synchronous solve.
    requestAnimationFrame(() => {
      const summary = runSelfTest()
      setLastResult(`${summary.successCount}/${summary.total} ok · max ${summary.maxErrorMm.toFixed(2)} mm`)
      setRunning(false)
    })
  }

  return (
    <div className="ik-self-test">
      <button type="button" onClick={handleClick} disabled={running}>
        {running ? 'Running…' : 'IK self-test (25 targets)'}
      </button>
      {lastResult && <div className="ik-self-test-result">{lastResult}</div>}
    </div>
  )
}

export default IkSelfTest
