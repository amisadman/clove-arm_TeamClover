import { useState } from 'react'
import JointControls from './JointControls'
import MoveToPanel from './MoveToPanel'
import PinPanel from './PinPanel'
import Popup from './Popup'
import './ControlDock.css'

type PopupKey = 'joints' | 'moveTo'

const POPUP_TITLES: Record<PopupKey, string> = {
  joints: 'Joint Controls',
  moveTo: 'Go To Target',
}

function ControlDock() {
  const [active, setActive] = useState<PopupKey | null>(null)

  const toggle = (key: PopupKey) => {
    setActive((prev) => (prev === key ? null : key))
  }

  return (
    <>
      <div className="control-dock-left">
        {active && (
          <Popup key={active} title={POPUP_TITLES[active]} onClose={() => setActive(null)}>
            {active === 'joints' ? <JointControls /> : <MoveToPanel />}
          </Popup>
        )}

        <div className="dock-triggers">
          <button
            type="button"
            className={`dock-trigger${active === 'joints' ? ' dock-trigger-active' : ''}`}
            onClick={() => toggle('joints')}
          >
            Joint Controls
          </button>
          <button
            type="button"
            className={`dock-trigger${active === 'moveTo' ? ' dock-trigger-active' : ''}`}
            onClick={() => toggle('moveTo')}
          >
            Go To Target
          </button>
        </div>
      </div>

      <div className="control-dock-center">
        <div className="pin-bar">
          <PinPanel />
        </div>
      </div>
    </>
  )
}

export default ControlDock
