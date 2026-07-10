import { useKeyboard } from "./useKeyboard";
import "./KeymapLegend.css";

const VOICE_COMMANDS = [
  { command: '"move up / down / left / right / forward / back [N]"', desc: "jog that direction, N cm (default 5)" },
  { command: '"rotate joint 1-6 by N degrees"', desc: "rotate a single joint" },
  { command: '"home"', desc: "return to the home pose" },
  { command: '"enter / press / type pin 123456"', desc: "run the 6-digit PIN sequence" },
  { command: '"abort / stop / cancel pin"', desc: "abort a running PIN entry" },
  { command: "anything else", desc: "sent to the AI agent to interpret and act on" },
]

function KeymapLegend() {
  const { fine, legendVisible } = useKeyboard();

  return (
    <div className="keymap-hint">
      {fine && <span className="keymap-fine-badge">Shift</span>}
      <span className="keymap-toggle-hint">Shift + ?</span>
      {legendVisible && (
        <div className="keymap-legend">
          <div className="keymap-section-title">Keyboard</div>
          <div className="keymap-row">
            <span>W / S</span>
            <span>+X / −X</span>
          </div>
          <div className="keymap-row">
            <span>A / D</span>
            <span>+Y / −Y</span>
          </div>
          <div className="keymap-row">
            <span>Q / E</span>
            <span>+Z / −Z</span>
          </div>
          <div className="keymap-row">
            <span>Arrows</span>
            <span>mirror WASD</span>
          </div>
          <div className="keymap-row">
            <span>Shift</span>
            <span>fine mode</span>
          </div>
          <div className="keymap-row">
            <span>H</span>
            <span>home</span>
          </div>
          <div className="keymap-row">
            <span>?</span>
            <span>toggle legend</span>
          </div>

          <div className="keymap-section-title">Voice Commands</div>
          {VOICE_COMMANDS.map((v) => (
            <div className="keymap-voice-row" key={v.command}>
              <span className="keymap-voice-command">{v.command}</span>
              <span className="keymap-voice-desc">{v.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KeymapLegend;
