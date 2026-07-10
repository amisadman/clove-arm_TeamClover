import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, ContactShadows, SoftShadows } from '@react-three/drei'
import RobotArm from './RobotArm'
import KeyPanel from './KeyPanel'
import TelemetryUpdater from './TelemetryUpdater'

function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [1.2, 0.9, 1.2], fov: 45 }}
      style={{ width: '100%', height: '100%', background: '#15171c' }}
    >
      <color attach="background" args={['#15171c']} />
      <SoftShadows size={12} samples={12} focus={0.6} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[2, 3, 1.5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={0.25} />
      </Suspense>

      <Grid
        args={[10, 10]}
        infiniteGrid
        cellSize={0.1}
        cellColor="#2a2d36"
        sectionSize={0.5}
        sectionColor="#3a3e4a"
        fadeDistance={8}
        fadeStrength={1}
      />

      <ContactShadows
        position={[0.3, 0.001, 0]}
        opacity={0.55}
        scale={2.5}
        blur={2.2}
        far={1}
      />

      <OrbitControls makeDefault target={[0.3, 0.3, 0]} />

      {/* URDF is Z-up; Three.js is Y-up. Robot and key panel share this frame. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <RobotArm />
        <KeyPanel />
        <TelemetryUpdater />
      </group>
    </Canvas>
  )
}

export default Scene
