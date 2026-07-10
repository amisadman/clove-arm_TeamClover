# Clove Arm — Phase 1: See the Arm

A browser-based 3D visualization of a 6-DOF industrial robotic arm (7 actuated
joints including a stylus pitch), built for a hackathon demo.

## What Phase 1 delivers

- Loads and renders the provided URDF (`stylus_arm`, primitive geometry only)
  in a lit, orbitable 3D scene.
- Renders the 6-key test panel at the coordinates defined in
  `key.config.json`, sitting next to the arm on the factory floor.
- A live dashboard showing all 7 joint angles (in degrees, with a limit-range
  bar) and the stylus tip position in meters, in the `base_link` frame.
- Joint sliders for posing the arm live, plus "Home" and "Demo pose" buttons.

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

## Project structure

```
src/
  sim/          # Canvas-only: scene, robot, key panel, telemetry updater
  dashboard/    # DOM overlay: joint/TCP readout, sliders, title bar
```

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

## Screenshot

_placeholder — add a screenshot of the running demo here._
