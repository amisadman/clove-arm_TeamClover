import type { ReactNode } from 'react'
import './Popup.css'

interface PopupProps {
  title: string
  onClose: () => void
  children: ReactNode
}

function Popup({ title, onClose, children }: PopupProps) {
  return (
    <div className="popup-panel">
      <div className="popup-header">
        <span className="popup-title">{title}</span>
        <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="popup-body">{children}</div>
    </div>
  )
}

export default Popup
