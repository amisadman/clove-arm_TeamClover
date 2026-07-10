import './TitleBar.css'

function TitleBar() {
  return (
    <div className="title-bar">
      <div>
        <span className="title-bar-name">CLOVE ARM</span>
        <span className="title-bar-phase">Phase 1 — Visualization</span>
      </div>
      <div className="status-badge">
        <span className="status-dot" />
        SIMULATION LIVE
      </div>
    </div>
  )
}

export default TitleBar
