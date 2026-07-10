import { useEffect, useState } from "react";
import { Mesh } from "three";
import URDFLoader from "urdf-loader";
import type { URDFRobot } from "urdf-loader";
import { setRobot } from "./robotStore";

function RobotArm() {
  const [robot, setRobotState] = useState<URDFRobot | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loader = new URDFLoader();
    loader.load("/6_dof_arm.urdf", (loadedRobot) => {
      if (cancelled) return;

      loadedRobot.traverse((child) => {
        if ((child as Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      setRobot(loadedRobot);
      setRobotState(loadedRobot);
    });

    return () => {
      cancelled = true;
    };
  }, []);
  console.log("ROBOTTTTT", robot);
  if (!robot) return null;

  return <primitive object={robot} />;
}

export default RobotArm;
