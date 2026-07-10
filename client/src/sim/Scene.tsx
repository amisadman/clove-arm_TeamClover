import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'

function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [1.2, 0.9, 1.2], fov: 45 }}
      style={{ width: '100%', height: '100%', background: '#15171c' }}
    >
      <color attach="background" args={['#15171c']} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[2, 3, 1.5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

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

      <OrbitControls makeDefault target={[0.3, 0.3, 0]} />
    </Canvas>
  )
}

export default Scene
