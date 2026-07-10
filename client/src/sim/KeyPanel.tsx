import { useEffect, useState } from 'react'
import { Text } from '@react-three/drei'
import { setKeyConfig, type KeyConfig } from './keyConfig'

const KEY_SIZE: [number, number, number] = [0.04, 0.04, 0.02]
const KEY_COLOR = '#c7cbd1'
const KEY_HOVER_EMISSIVE = '#f2991a'

function Key({ label, x, y, z }: { label: string; x: number; y: number; z: number }) {
  const [hovered, setHovered] = useState(false)
  const centerZ = z - KEY_SIZE[2] / 2

  return (
    <group>
      <mesh
        position={[x, y, centerZ]}
        castShadow
        receiveShadow
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={KEY_SIZE} />
        <meshStandardMaterial
          color={KEY_COLOR}
          emissive={hovered ? KEY_HOVER_EMISSIVE : '#000000'}
          emissiveIntensity={hovered ? 0.6 : 0}
        />
      </mesh>
      <Text
        position={[x, y, z + 0.0006]}
        fontSize={0.018}
        color="#1a1b1f"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}

function KeyPanel() {
  const [config, setConfig] = useState<KeyConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/key.config.json')
      .then((res) => res.json())
      .then((data: KeyConfig) => {
        if (cancelled) return
        setKeyConfig(data)
        setConfig(data)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!config) return null

  const entries = Object.entries(config.keys)
  const xs = entries.map(([, k]) => k.x)
  const ys = entries.map(([, k]) => k.y)
  const minX = Math.min(...xs) - 0.02
  const maxX = Math.max(...xs) + 0.02
  const minY = Math.min(...ys) - 0.02
  const maxY = Math.max(...ys) + 0.02

  const plateThickness = 0.02
  const plateTopZ = Math.min(...entries.map(([, k]) => k.z)) - KEY_SIZE[2]
  const plateCenterZ = plateTopZ - plateThickness / 2

  return (
    <group>
      <mesh
        position={[(minX + maxX) / 2, (minY + maxY) / 2, plateCenterZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[maxX - minX, maxY - minY, plateThickness]} />
        <meshStandardMaterial color="#24262c" />
      </mesh>
      {entries.map(([label, pos]) => (
        <Key key={label} label={label} x={pos.x} y={pos.y} z={pos.z} />
      ))}
    </group>
  )
}

export default KeyPanel
