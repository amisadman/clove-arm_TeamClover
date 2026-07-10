import { useEffect, useState } from "react";
import { getControllerCount, subscribeControllerCount } from "../controls/remoteStore";
import "./TitleBar.css";

function TitleBar() {
  const [controllerCount, setControllerCount] = useState(getControllerCount());

  useEffect(() => {
    return subscribeControllerCount(() => {
      setControllerCount(getControllerCount());
    });
  }, []);

  return (
    <div className="title-bar">
      <div>
        <span className="title-bar-name">
          CLOVE<span style={{ color: "#d7bf66" }}>ARM</span>
        </span>
      </div>
      <div className="title-bar-badge-container">
        {controllerCount > 0 ? (
          <span className="controller-badge connected">
            📱 {controllerCount} {controllerCount === 1 ? 'controller' : 'controllers'} connected
          </span>
        ) : (
          <span className="controller-badge disconnected">
            📱 No controller
          </span>
        )}
      </div>
    </div>
  );
}

export default TitleBar;
