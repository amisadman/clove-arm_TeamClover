import { Routes, Route } from "react-router-dom";
import Scene from "./sim/Scene";
import TitleBar from "./dashboard/TitleBar";
import CoordinateCard from "./dashboard/CoordinateCard";
import StatusCard from "./dashboard/StatusCard";
import ToastHost from "./dashboard/ToastHost";
import Joystick from "./controls/Joystick";
import KeymapLegend from "./controls/KeymapLegend";
import ControlDock from "./dashboard/ControlDock";
import ControllerPage from "./pages/ControllerPage";
import useRemoteCommands from "./controls/useRemoteCommands";

function Dashboard() {
  useRemoteCommands();
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
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/controller" element={<ControllerPage />} />
    </Routes>
  );
}

export default App;
