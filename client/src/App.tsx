import Scene from './sim/Scene'
import Dashboard from './dashboard/Dashboard'
import TitleBar from './dashboard/TitleBar'
import ToastHost from './dashboard/ToastHost'
import Joystick from './controls/Joystick'
import KeymapLegend from './controls/KeymapLegend'

function App() {
  return (
    <div id="app">
      <Scene />
      <TitleBar />
      <Dashboard />
      <ToastHost />
      <Joystick />
      <KeymapLegend />
    </div>
  )
}

export default App
