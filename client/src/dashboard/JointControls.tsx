import { useEffect, useState } from "react";
import { getRobot } from "../sim/robotStore";
import { fk } from "../kinematics/solverTwin";
import { JOINT_ORDER, type JointVector } from "../kinematics/jointOrder";
import { emit } from "../pipeline/commandBus";
import { telemetryRef } from "./telemetry";
import "./JointControls.css";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const DEMO_POSE_DEG: Record<string, number> = {
  joint_2: -45,
  joint_3: 60,
  joint_5: 30,
};

function JointControls() {
  const [angles, setAngles] = useState<Record<string, number>>({});

  useEffect(() => {
    const id = setInterval(() => {
      setAngles({ ...telemetryRef.current.jointAngles });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const names = JOINT_ORDER.filter(
    (name) => name in angles || getRobot()?.joints[name],
  );

  const handleHome = () => {
    emit({ type: "HOME" });
  };

  const handleDemoPose = () => {
    const demoQ: JointVector = JOINT_ORDER.map(
      (name) => (DEMO_POSE_DEG[name] ?? 0) * DEG_TO_RAD,
    );
    const target = fk(demoQ);
    emit({
      type: "MOVE_TO",
      target: { x: target.x, y: target.y, z: target.z },
    });
  };

  const handleChange = (name: string, rad: number) => {
    getRobot()?.setJointValue(name, rad);
    setAngles((prev) => ({ ...prev, [name]: rad }));
  };

  if (names.length === 0) return null;

  return (
    <div className="joint-controls">
      <div className="pose-buttons">
        <button type="button" onClick={handleHome}>
          Home
        </button>
        <button type="button" onClick={handleDemoPose}>
          Demo pose
        </button>
      </div>
      {names.map((name) => {
        const robot = getRobot();
        const limit = robot?.joints[name]?.limit;
        const lower = Number.isFinite(limit?.lower) ? limit!.lower : -Math.PI;
        const upper = Number.isFinite(limit?.upper) ? limit!.upper : Math.PI;
        const current = angles[name] ?? 0;

        return (
          <div className="slider-row" key={name}>
            <div className="slider-label">
              <span>{name}</span>
              <span>{(current * RAD_TO_DEG).toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min={lower}
              max={upper}
              step={0.01}
              value={current}
              onChange={(event) =>
                handleChange(name, Number(event.target.value))
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export default JointControls;
