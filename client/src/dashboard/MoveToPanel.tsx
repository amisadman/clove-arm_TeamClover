import { useState } from 'react'
import { emit } from '../pipeline/commandBus'
import { getKeyConfig } from '../sim/keyConfig'
import './MoveToPanel.css'

const HOVER_OFFSET_M = 0.05
const KEY_LABELS = ['1', '2', '3', '4', '5', '6']

function MoveToPanel() {
  const [x, setX] = useState('0.30')
  const [y, setY] = useState('0.00')
  const [z, setZ] = useState('0.30')

  const handleGo = () => {
    const target = { x: Number(x), y: Number(y), z: Number(z) }
    if (Number.isNaN(target.x) || Number.isNaN(target.y) || Number.isNaN(target.z)) return
    emit({ type: 'MOVE_TO', target })
  }

  const handleKey = (label: string) => {
    const key = getKeyConfig()?.keys[label]
    if (!key) return
    emit({ type: 'MOVE_TO', target: { x: key.x, y: key.y, z: key.z + HOVER_OFFSET_M } })
  }

  return (
    <div className="move-to-panel">
      <div className="target-inputs">
        <input type="number" step="0.01" value={x} onChange={(event) => setX(event.target.value)} placeholder="x" />
        <input type="number" step="0.01" value={y} onChange={(event) => setY(event.target.value)} placeholder="y" />
        <input type="number" step="0.01" value={z} onChange={(event) => setZ(event.target.value)} placeholder="z" />
        <button type="button" onClick={handleGo}>
          Go
        </button>
      </div>
      <div className="key-quick-buttons">
        {KEY_LABELS.map((label) => (
          <button type="button" key={label} onClick={() => handleKey(label)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default MoveToPanel
