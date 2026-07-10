import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { getRobot } from './robotStore'
import { telemetryRef } from '../dashboard/telemetry'

const worldPos = new Vector3()

function TelemetryUpdater() {
  useFrame(() => {
    const robot = getRobot()
    if (!robot) return

    const jointAngles: Record<string, number> = {}
    for (const [name, joint] of Object.entries(robot.joints)) {
      if (joint.jointType === 'fixed') continue
      jointAngles[name] = joint.angle as number
    }
    telemetryRef.current.jointAngles = jointAngles

    const tipLink = robot.links['stylus_tip']
    if (tipLink) {
      tipLink.getWorldPosition(worldPos)
      robot.worldToLocal(worldPos)
      telemetryRef.current.tcp.x = worldPos.x
      telemetryRef.current.tcp.y = worldPos.y
      telemetryRef.current.tcp.z = worldPos.z
    }
  })

  return null
}

export default TelemetryUpdater
