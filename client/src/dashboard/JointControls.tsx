import { useState, useSyncExternalStore } from 'react'
import { getRobot, subscribeRobot } from '../sim/robotStore'
import './JointControls.css'

const JOINT_ORDER = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6', 'stylus_pitch']
const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

const DEMO_POSE_DEG: Record<string, number> = {
  joint_2: -45,
  joint_3: 60,
  joint_5: 30,
}

function JointControls() {
  const robot = useSyncExternalStore(subscribeRobot, getRobot)
  const [values, setValues] = useState<Record<string, number>>({})

  if (!robot) return null

  const names = JOINT_ORDER.filter((name) => robot.joints[name])

  const applyPose = (poseDeg: Record<string, number>) => {
    const next: Record<string, number> = {}
    names.forEach((name) => {
      const rad = (poseDeg[name] ?? 0) * DEG_TO_RAD
      robot.setJointValue(name, rad)
      next[name] = rad
    })
    setValues(next)
  }

  const handleChange = (name: string, rad: number) => {
    robot.setJointValue(name, rad)
    setValues((prev) => ({ ...prev, [name]: rad }))
  }

  return (
    <div className="joint-controls">
      <h2>Joint Control</h2>
      <div className="pose-buttons">
        <button type="button" onClick={() => applyPose({})}>
          Home
        </button>
        <button type="button" onClick={() => applyPose(DEMO_POSE_DEG)}>
          Demo pose
        </button>
      </div>
      {names.map((name) => {
        const limit = robot.joints[name].limit
        const lower = Number.isFinite(limit?.lower) ? limit.lower : -Math.PI
        const upper = Number.isFinite(limit?.upper) ? limit.upper : Math.PI
        const current = values[name] ?? (robot.joints[name].angle as number) ?? 0

        return (
          <div className="slider-row" key={name}>
            <div className="slider-label">
              <span>{name}</span>
              <span>{(current * RAD_TO_DEG).toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min={lower}
              max={upper}
              step={0.01}
              value={current}
              onChange={(event) => handleChange(name, Number(event.target.value))}
            />
          </div>
        )
      })}
    </div>
  )
}

export default JointControls
