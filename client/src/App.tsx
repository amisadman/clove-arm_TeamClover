import Scene from './sim/Scene'
import Dashboard from './dashboard/Dashboard'
import TitleBar from './dashboard/TitleBar'
import ToastHost from './dashboard/ToastHost'
import Joystick from './controls/Joystick'
import KeymapLegend from './controls/KeymapLegend'
import VoiceControl from './controls/VoiceControl'

function App() {
  return (
    <div id="app">
      <Scene />
      <TitleBar />
      <Dashboard />
      <ToastHost />
      <Joystick />
      <KeymapLegend />
      <VoiceControl />
    </div>
  )
}

export default App