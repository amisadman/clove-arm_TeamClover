import { useEffect, useState } from 'react'
import { telemetryRef } from './telemetry'
import { getRobot } from '../sim/robotStore'
import { JOINT_ORDER } from '../kinematics/jointOrder'
import JointControls from './JointControls'
import IkSelfTest from './IkSelfTest'
import MoveToPanel from './MoveToPanel'
import './Dashboard.css'

const RAD_TO_DEG = 180 / Math.PI

interface JointReadout {
  name: string
  angleDeg: number
  ratio: number
}

interface DashboardState {
  joints: JointReadout[]
  tcp: { x: number; y: number; z: number }
  status: string
}

function Dashboard() {
  const [state, setState] = useState<DashboardState>({
    joints: [],
    tcp: { x: 0, y: 0, z: 0 },
    status: 'idle',
  })

  useEffect(() => {
    const id = setInterval(() => {
      const robot = getRobot()
      const { jointAngles, tcp, status } = telemetryRef.current

      const joints: JointReadout[] = JOINT_ORDER.filter((name) => name in jointAngles).map((name) => {
        const angle = jointAngles[name]
        const limit = robot?.joints[name]?.limit
        let ratio = 0.5
        if (limit && Number.isFinite(limit.lower) && Number.isFinite(limit.upper) && limit.upper > limit.lower) {
          ratio = Math.min(1, Math.max(0, (angle - limit.lower) / (limit.upper - limit.lower)))
        }
        return { name, angleDeg: angle * RAD_TO_DEG, ratio }
      })

      setState({ joints, tcp: { ...tcp }, status })
    }, 100)

    return () => clearInterval(id)
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-section">
        <h2>Joint Angles</h2>
        {state.joints.map((joint) => (
          <div className="joint-row" key={joint.name}>
            <span className="joint-name">{joint.name}</span>
            <span className="joint-angle">{joint.angleDeg.toFixed(1)}°</span>
            <div className="joint-bar">
              <div className="joint-bar-fill" style={{ width: `${joint.ratio * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-section">
        <h2>Stylus Tip (base frame, m)</h2>
        <div className="tcp-row">
          <span>X</span>
          <span>{state.tcp.x.toFixed(3)}</span>
        </div>
        <div className="tcp-row">
          <span>Y</span>
          <span>{state.tcp.y.toFixed(3)}</span>
        </div>
        <div className="tcp-row">
          <span>Z</span>
          <span>{state.tcp.z.toFixed(3)}</span>
        </div>
        <div className="tcp-row">
          <span>Status</span>
          <span>{state.status}</span>
        </div>
      </div>
      <div className="dashboard-section">
        <MoveToPanel />
      </div>
      <div className="dashboard-section">
        <JointControls />
      </div>
      <div className="dashboard-section">
        <IkSelfTest />
      </div>
    </div>
  )
}

export default Dashboard
