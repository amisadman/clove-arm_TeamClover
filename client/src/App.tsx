import Scene from './sim/Scene'
import Dashboard from './dashboard/Dashboard'
import TitleBar from './dashboard/TitleBar'
import ToastHost from './dashboard/ToastHost'
import './pipeline/safetyGate'

function App() {
  return (
    <div id="app">
      <Scene />
      <TitleBar />
      <Dashboard />
      <ToastHost />
    </div>
  )
}

export default App
