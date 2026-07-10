import { useKeyboard } from './useKeyboard'
import './KeymapLegend.css'

function KeymapLegend() {
  const { fine, legendVisible } = useKeyboard()

  return (
    <div className="keymap-hint">
      {fine && <span className="keymap-fine-badge">FINE</span>}
      <span className="keymap-toggle-hint">Press ? for keymap</span>
      {legendVisible && (
        <div className="keymap-legend">
          <div className="keymap-row">
            <span>W / S</span>
            <span>+X / −X</span>
          </div>
          <div className="keymap-row">
            <span>A / D</span>
            <span>+Y / −Y</span>
          </div>
          <div className="keymap-row">
            <span>Q / E</span>
            <span>+Z / −Z</span>
          </div>
          <div className="keymap-row">
            <span>Arrows</span>
            <span>mirror WASD</span>
          </div>
          <div className="keymap-row">
            <span>Shift</span>
            <span>fine mode</span>
          </div>
          <div className="keymap-row">
            <span>H</span>
            <span>home</span>
          </div>
          <div className="keymap-row">
            <span>?</span>
            <span>toggle legend</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default KeymapLegend
