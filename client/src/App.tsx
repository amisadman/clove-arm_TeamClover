import Scene from './sim/Scene'
import TitleBar from './dashboard/TitleBar'
import ToastHost from './dashboard/ToastHost'
import Joystick from './controls/Joystick'
import KeymapLegend from './controls/KeymapLegend'
import CoordinateCard from './dashboard/CoordinateCard'
import StatusCard from './dashboard/StatusCard'
import ControlDock from './dashboard/ControlDock'

function App() {
  return (
    <div id="app">
      <Scene />
      <TitleBar />
      <CoordinateCard />
      <StatusCard />
      <ToastHost />
      <Joystick />
      <KeymapLegend />
      <ControlDock />
    </div>
  )
}

export default App
