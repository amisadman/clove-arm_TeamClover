import { useEffect, useState } from 'react'
import { subscribeToast, type ToastMessage } from './toast'
import './ToastHost.css'

const DISMISS_MS = 3500

function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, DISMISS_MS)
    })
  }, [])

  return (
    <div className="toast-host">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          {toast.text}
        </div>
      ))}
    </div>
  )
}

export default ToastHost
