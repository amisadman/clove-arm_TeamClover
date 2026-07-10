# Clove Arm — See the Arm, Move the Arm, Autonomous PIN Entry

A browser-based 3D simulation of a 6-DOF industrial robotic arm (7 actuated
joints including a stylus pitch) that can be jogged by hand or driven
autonomously to type a PIN on a 6-key panel — built for a hackathon demo.

## What Phase 1 delivers

- Loads and renders the provided URDF (`stylus_arm`, primitive geometry only)
  in a lit, orbitable 3D scene.
- Renders the 6-key test panel at the coordinates defined in
  `key.config.json`, sitting next to the arm on the factory floor.
- A live dashboard showing all 7 joint angles (in degrees, with a limit-range
  bar) and the stylus tip position in meters, in the `base_link` frame.
- Joint sliders for posing the arm live, plus "Home" and "Demo pose" buttons.

## What Phase 2 + 4 deliver

- A numerical **inverse kinematics** solver (Damped Least Squares) that turns
  a Cartesian target into joint angles.
- A **deterministic safety gate** — every commanded move is checked against
  workspace bounds, reachability, joint limits and a rate limit before it
  ever reaches the robot.
- A single **motion pipeline**: every control surface (sliders, on-screen
  joystick, keyboard, "Go to target", PIN sequencer) emits the same
  `MotionCommand` objects onto one command bus; one executor owns all motion.
- On-screen joystick + keyboard jogging, driving the identical pipeline.
- **Autonomous PIN entry**: given a 6-digit PIN, the arm hovers, descends,
  checks tip-to-key error against a ±5 mm tolerance, and retracts — key by
  key, aborting cleanly on any rejection or missed tolerance.
- An optional "stylus-down" orientation bias so presses look vertical.

No backend in this phase — the URDF and key config are served statically
from `public/`.

## Stack

- **Vite + React + TypeScript** — app shell and dev server.
- **three** — the underlying 3D engine.
- **@react-three/fiber** — React renderer for three.js scene graphs.
- **@react-three/drei** — `OrbitControls`, `Grid`, `Environment`,
  `ContactShadows`, `Text`, and other scene helpers.
- **urdf-loader** — parses the URDF and builds a `URDFRobot` (a three.js
  `Object3D` tree) with named `joints` and `links`, and a `setJointValue` API.

## Architecture notes

### The Z-up / Y-up trick

The URDF and `key.config.json` both use a **Z-up** convention (URDF
standard), while three.js is **Y-up** by default. Rather than converting
every coordinate by hand, the robot and the key panel are both mounted
inside one shared group:

```tsx
<group rotation={[-Math.PI / 2, 0, 0]}>
  <RobotArm />
  <KeyPanel />
</group>
```

This rotates the entire subtree from Z-up into three.js's Y-up world, so all
positions inside that group — robot links, key coordinates from the config
file — can be used exactly as given in the base frame, with no manual axis
swapping. See [src/sim/Scene.tsx](src/sim/Scene.tsx).

### `stylus_tip` and frame conversion

The URDF defines a fixed frame `stylus_tip` at the stylus nib. The dashboard
reports the end-effector position as the world position of `stylus_tip`,
expressed back in `base_link`'s frame:

```ts
tipLink.getWorldPosition(worldPos) // world space (post Z-up→Y-up rotation)
robot.worldToLocal(worldPos)       // back into the robot's own local frame,
                                    // which IS base_link's frame
```

Because `robot.worldToLocal` accounts for the full ancestor transform chain
(including the shared group's rotation), the result lands back in the
original Z-up base-frame coordinates from the URDF — no extra math needed.
See [src/sim/TelemetryUpdater.tsx](src/sim/TelemetryUpdater.tsx).

As a sanity check: with all 7 joints at 0°, the arm is fully extended
straight up, and the stylus tip should read `(0, 0, 1.497)` — the sum of the
link offsets along the chain (0.06 + 0.25 + 0.25 + 0.25 + 0.15 + 0.25 + 0.15
+ 0.137 m).

### Data flow (dashboard)

A per-frame `useFrame` hook ([TelemetryUpdater.tsx](src/sim/TelemetryUpdater.tsx))
writes joint angles and TCP position into a shared mutable ref
([telemetry.ts](src/dashboard/telemetry.ts)) — no React state, no
per-frame re-renders. The DOM-based `Dashboard` component polls that ref on
a 100 ms interval and updates its own state, giving live-feeling updates
without paying for 60 fps React re-renders.

## Motion pipeline architecture

Every control surface — sliders, joystick, keyboard, "Go to target", the PIN
sequencer — emits the same three command shapes onto one bus. One executor,
living inside the Canvas `useFrame` loop, is the only place that ever writes
a joint value onto the rendered robot:

```
 sliders ─┐
 joystick ├─▶ commandBus.emit({ type, ... }) ──▶ motionExecutor (useFrame)
 keyboard │        JOG | MOVE_TO | HOME              │
 PIN seq ─┘                                          ├─▶ safetyGate.validate()
                                                       │      (bounds, IK reachability,
                                                       │       joint limits, rate limit)
                                                       ├─▶ ikDLS.solveIK() (warm-started)
                                                       └─▶ robot.setJointValue(...)
```

`JOG` deltas are gated and solved every frame (1-3 warm-started iterations).
`MOVE_TO` is gated **once** at command entry, then the executor eases the
*target point* from the current tip position to the goal over time and
re-solves IK each frame — so a rejected far-off target never partially moves
the arm. `HOME` is a joint-space ease back to all-zeros (a Cartesian move
can't reliably return to a known configuration; a joint-space one always
can). The PIN sequencer never touches the robot directly — it only emits
`MOVE_TO` commands and awaits the executor's completion events, exactly like
a human driving the "Go to target" panel.

### Why Damped Least Squares for IK

Numerical DLS was chosen over an analytic (closed-form) solver because the
arm is **7-DOF for a 3-DOF task** (position-only) — that redundancy has no
single closed-form solution, but a numerical Jacobian handles it for free.
Damping (`λ = 0.08`) trades a little accuracy for stability: near
singularities (e.g. near full extension) an undamped least-squares step can
blow up, while the damped term keeps every step finite and smooth. Clamping
the error vector to `maxStep = 0.05 m` per iteration stops far-away targets
from producing a single wild joint jump — instead the solver takes a bounded
step every iteration and re-linearizes. Warm starts (seeding `q` from the
current pose instead of zero) are what make this cheap enough to run every
frame: a JOG delta only moves the target a few millimeters, so the solver is
already almost converged and exits in 1-3 iterations instead of the ~30-60
a cold start from a resting pose can need.

> **Deviation from the original plan:** the plan's suggested `maxIter = 30`
> only solved 5-15/25 self-test targets from the home pose — independent
> verification showed the worst-case cold start (home, arm pointing straight
> up → a target near the floor) needs ~36 iterations given the 0.05 m step
> clamp. `maxIter` is now 80 for cold starts (self-test, first move from
> rest); warm-started JOG/MOVE_TO frames still exit in a handful of
> iterations, so this costs nothing at 60 fps.

### Safety gate checklist

`safetyGate.validate(target, context)` runs, in order, and returns on the
first failure with a human-readable reason:

1. **Workspace bounds** — target z ≥ 0 (floor), radial distance from the
   base axis ≤ 1.45 m, inside a sane bounding box.
2. **Reachability** — runs the IK solver; rejects if it didn't converge or
   the final error exceeds 5 mm.
3. **Joint limits** — asserted again on the solved pose (defense in depth —
   the solver already clamps every iteration, but a future solver change
   shouldn't be able to silently ship an out-of-range joint).
4. **Rate limit** — no single joint may jump more than 1.5 rad in one
   *uninterpolated* step. `MOVE_TO` commands are exempt from this check
   because the executor always interpolates them smoothly over time; the
   check exists to catch a raw JOG delta gone wrong, not a legitimate far
   destination (verified: the "Key 1…6" quick buttons need up to 1.538 rad
   of joint travel with their hover offset, which would fail this check if
   it weren't scoped to uninterpolated moves).

### Keymap (keyboard jogging)

| Key | Action | Key | Action |
|---|---|---|---|
| `W` / `S` | +X / −X | `Arrows` | mirror WASD |
| `A` / `D` | +Y / −Y | `Shift` | fine mode (×0.25 speed) |
| `Q` / `E` | +Z / −Z | `H` | home |
| `?` | toggle the on-screen keymap legend | | |

Keys are ignored while focus is in a text input. The on-screen joystick
emits the exact same `{ type: 'JOG', delta }` commands — hold both at once
and they compose.

### PIN tolerance

Each digit's press is checked against the **rubric's ±5 mm tolerance**:
after the descend leg completes, the sequencer reads the *actual* simulated
tip position from telemetry (not the solver's self-reported error) and
compares it to the key's true coordinate. A miss aborts the run at a safe
hover rather than continuing blindly onto the next digit.

## Project structure

```
src/
  sim/          # Canvas-only: scene, robot, key panel, telemetry updater
  kinematics/   # Solver twin, FK, numeric Jacobian, DLS IK, joint order/limits
  pipeline/     # Command bus, motion executor, safety gate, PIN sequencer
  controls/     # On-screen joystick, keyboard jogging
  dashboard/    # DOM overlay: joint/TCP readout, sliders, panels, title bar
```

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

## Demo script

A suggested run-through for judges, each step proving a different piece of
the rubric:

1. **Slider FK check** — drag any joint slider; the dashboard's joint angle
   and TCP readout update live. With all joints at 0°, TCP should read
   `(0, 0, 1.497)` — proof FK and the base-frame conversion are correct.
2. **IK self-test button** — click it; watch the toast report ≥24/25 random
   targets solved with sub-millimeter error, live in front of the judges.
3. **Joystick** — hold the pad right; the tip glides smoothly in +X and
   stops the instant you release. Push it toward the floor or out of reach
   to show the safety gate pinning the tip at the boundary.
4. **Keyboard** — `WASD`/`QE` jog the same way; hold a joystick drag and a
   keyboard key at once to show both control surfaces feeding the identical
   pipeline.
5. **Key quick-buttons** — click "3"; the tip glides to just above key 3 and
   the TCP readout converges to `(0.60, 0.05, 0.10)`.
6. **PIN `142536`** — enter it and hit Start; watch each key hover, descend,
   flash green with its measured error, and retract in sequence.

## Screenshot

_placeholder — add a screenshot of the running demo here._
