import { useState, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import socket from '../socket/socket';
import './ControllerPage.css';

interface KeyCoords {
  x: number;
  y: number;
  z: number;
}

interface KeyConfig {
  keys: {
    [key: string]: KeyCoords;
  };
}

const DEFAULT_KEYS: { [key: string]: KeyCoords } = {
  '1': { x: 0.500, y: 0.050, z: 0.050 },
  '2': { x: 0.550, y: 0.050, z: 0.050 },
  '3': { x: 0.600, y: 0.050, z: 0.050 },
  '4': { x: 0.500, y: -0.050, z: 0.050 },
  '5': { x: 0.550, y: -0.050, z: 0.050 },
  '6': { x: 0.600, y: -0.050, z: 0.050 }
};

const PAD_RADIUS_PX = 44;

export default function ControllerPage() {
  const [connected, setConnected] = useState(socket.connected);
  const [keysConfig, setKeysConfig] = useState<{ [key: string]: KeyCoords }>(DEFAULT_KEYS);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string>('None');

  const padRef = useRef<HTMLDivElement>(null);
  const knobOffsetRef = useRef(knobOffset);
  knobOffsetRef.current = knobOffset;

  const zTimerRef = useRef<any>(null);

  // Monitor Socket connections
  useEffect(() => {
    socket.emit('register', 'controller');

    const handleConnect = () => {
      setConnected(true);
      socket.emit('register', 'controller');
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Fetch key configs
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    fetch(`${serverUrl}/api/key-config`)
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json() as Promise<KeyConfig>;
      })
      .then((data) => {
        if (data && data.keys) {
          setKeysConfig(data.keys);
        }
      })
      .catch(() => {
        // Fallback already set to DEFAULT_KEYS
      });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      if (zTimerRef.current) clearInterval(zTimerRef.current);
    };
  }, []);

  // Joystick 30fps interval while dragging
  useEffect(() => {
    if (isDragging) {
      const timer = setInterval(() => {
        const { x, y } = knobOffsetRef.current;
        // Map joystick knob offset (-1 to 1) to XY velocity capped at 0.15 m/s
        // Jog displacement per interval: velocity * dt where dt = 1/30s
        const dx = x * 0.15 * (1 / 30);
        const dy = -y * 0.15 * (1 / 30); // inverted so up on knob moves +Y
        const command = { type: 'JOG', delta: { dx, dy, dz: 0 } };
        socket.emit('command', command);
        setLastCommand(JSON.stringify(command));
      }, 1000 / 30);

      return () => clearInterval(timer);
    }
  }, [isDragging]);

  const updateKnobFromPointer = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let ox = clientX - cx;
    let oy = clientY - cy;
    const dist = Math.hypot(ox, oy);
    if (dist > PAD_RADIUS_PX) {
      ox = (ox / dist) * PAD_RADIUS_PX;
      oy = (oy / dist) * PAD_RADIUS_PX;
    }
    setKnobOffset({ x: ox / PAD_RADIUS_PX, y: oy / PAD_RADIUS_PX });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    updateKnobFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateKnobFromPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setKnobOffset({ x: 0, y: 0 });
  };

  // Z-Axis jogging helpers
  const startZ = (dir: 1 | -1) => {
    if (zTimerRef.current) clearInterval(zTimerRef.current);
    const tickZ = () => {
      const command = { type: 'JOG', delta: { dx: 0, dy: 0, dz: dir * 0.004 } };
      socket.emit('command', command);
      setLastCommand(JSON.stringify(command));
    };
    tickZ();
    zTimerRef.current = setInterval(tickZ, 33);
  };

  const stopZ = () => {
    if (zTimerRef.current) {
      clearInterval(zTimerRef.current);
      zTimerRef.current = null;
    }
  };

  // Command button triggers
  const handleHome = () => {
    const command = { type: 'HOME' };
    socket.emit('command', command);
    setLastCommand(JSON.stringify(command));
  };

  const handleMoveToKey = (coords: KeyCoords) => {
    const command = {
      type: 'MOVE_TO',
      target: { x: coords.x, y: coords.y, z: coords.z + 0.06 }
    };
    socket.emit('command', command);
    setLastCommand(JSON.stringify(command));
  };

  const handleStop = () => {
    stopZ();
    setIsDragging(false);
    setKnobOffset({ x: 0, y: 0 });
    const command = { type: 'HOME' };
    socket.emit('command', command);
    setLastCommand(JSON.stringify(command));
  };

  // PIN validation & submission
  const handlePinChange = (val: string) => {
    const sanitized = val.replace(/[^1-6]/g, '').slice(0, 6);
    setPinInput(sanitized);
    setPinError(null);
  };

  const handleRunPin = () => {
    if (pinInput.length !== 6) {
      setPinError('PIN must be exactly 6 digits.');
      return;
    }
    const command = { type: 'ENTER_PIN', pin: pinInput };
    socket.emit('command', command);
    setLastCommand(JSON.stringify(command));
  };

  return (
    <div className="controller-page">
      <div className="controller-header">
        <div className="controller-title">
          CLOVE<span>ARM</span> Remote
        </div>
        <div className={`status-pill ${connected ? 'connected' : 'disconnected'}`}>
          <div className="status-dot" />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="controller-body">
        {/* Joystick & Z Control area */}
        <div className="control-row joystick-section">
          <div
            className="mobile-joystick-pad"
            ref={padRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              className="mobile-joystick-knob"
              style={{
                transform: `translate(${knobOffset.x * PAD_RADIUS_PX}px, ${knobOffset.y * PAD_RADIUS_PX}px)`,
              }}
            />
          </div>

          <div className="z-controls">
            <button
              className="z-button"
              type="button"
              onPointerDown={() => startZ(1)}
              onPointerUp={stopZ}
              onPointerLeave={stopZ}
              onPointerCancel={stopZ}
            >
              +Z
            </button>
            <button
              className="z-button"
              type="button"
              onPointerDown={() => startZ(-1)}
              onPointerUp={stopZ}
              onPointerLeave={stopZ}
              onPointerCancel={stopZ}
            >
              −Z
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="actions-row">
          <button className="action-btn home-btn" onClick={handleHome}>
            Home
          </button>
          <button className="action-btn stop-btn" onClick={handleStop}>
            Stop
          </button>
        </div>

        {/* Key Shortcuts */}
        <div className="keys-grid">
          {Object.entries(keysConfig).map(([digit, coords]) => (
            <button
              key={digit}
              className="key-btn"
              onClick={() => handleMoveToKey(coords)}
            >
              Key {digit}
              <span className="key-btn-sub">
                ({coords.x.toFixed(2)}, {coords.y.toFixed(2)})
              </span>
            </button>
          ))}
        </div>

        {/* PIN Entry */}
        <div className="pin-section">
          <div className="pin-section-title">Sequence PIN Run</div>
          <div className="pin-input-group">
            <input
              className="pin-input"
              type="text"
              pattern="[1-6]*"
              inputMode="numeric"
              placeholder="e.g. 142536"
              value={pinInput}
              onChange={(e) => handlePinChange(e.target.value)}
            />
            <button
              className="pin-run-btn"
              onClick={handleRunPin}
              disabled={pinInput.length !== 6}
            >
              Run
            </button>
          </div>
          {pinError && <div className="pin-error">{pinError}</div>}
        </div>
      </div>

      <div className="controller-footer">
        <strong>Last Cmd:</strong> &nbsp;{lastCommand}
      </div>
    </div>
  );
}
