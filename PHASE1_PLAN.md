# Phase 1 — "See the Arm" — Implementation Plan for Claude Code

## Context (read first)

We are building a browser-based simulation of a 6-DOF industrial robotic arm for a
hackathon. This plan covers **Phase 1 only**: load and render the provided URDF in 3D,
render the 6-key test panel at coordinates from `key.config.json`, and show a live
dashboard of joint angles + stylus-tip position. Judges arrive soon — prioritize a
working, good-looking demo over abstraction.

**Current state:** an empty Vite + React project (JavaScript). Two asset files exist
and must be placed in `public/`: `6_dof_arm.urdf` and `key.config.json`.

**Facts about the assets (do not rediscover these, trust them):**
- The URDF (`robot name="stylus_arm"`) uses **primitive geometry only** (cylinders,
  spheres, boxes) — no mesh files, so `urdf-loader` needs no STL/DAE loaders.
- It has **7 actuated revolute joints**: `joint_1` … `joint_6` plus `stylus_pitch`,
  and a **fixed TCP frame link named `stylus_tip`** at the stylus nib. The dashboard's
  "end-effector position" means the world position of `stylus_tip`, expressed in the
  `base_link` frame.
- URDF convention is **Z-up**; Three.js default is Y-up. Handle this by wrapping the
  robot AND the key panel in one shared `<group rotation={[-Math.PI/2, 0, 0]}>` so the
  key coordinates (given in the base frame, Z-up) can be used as-is inside that group.
- `key.config.json`: frame `base_link`, units meters, `approach_axis: "-z"`, six keys
  labeled "1"–"6" at x ∈ {0.50, 0.55, 0.60}, y ∈ {+0.05, −0.05}, z = 0.05. The key
  coordinate is the **touch point on the key's top surface** — render each key as a box
  whose top face is at that z.

**Working agreement:**
- After every step below: run the app, verify the acceptance check, then make **one
  commit** with the exact message given. Do not batch steps into one commit.
- Keep components small and files under ~150 lines where reasonable.
- No backend in this phase — serve assets from `public/`. (Express/Mongo come later.)
- Do not add state-management libraries; use refs + a throttled interval for the HUD.

---

## Step 0 — Dependencies and asset placement

Install: `three`, `@react-three/fiber`, `@react-three/drei`, `urdf-loader`.
Move `6_dof_arm.urdf` and `key.config.json` into `public/`. Strip the default Vite
boilerplate (logo, counter, default CSS) down to a clean `App.jsx`.

**Accept:** `npm run dev` starts with a blank page, no console errors.

**Commit:** `chore: add three/r3f/drei/urdf-loader and stage arm assets`

---

## Step 1 — Base 3D scene

Create `src/sim/Scene.jsx`: a full-viewport `<Canvas>` with:
- Camera at roughly `[1.2, 0.9, 1.2]` looking at `[0.3, 0.3, 0]` (arm is ~1 m tall,
  keys are ~0.55 m out), `fov` ~45.
- drei `<OrbitControls makeDefault />` with a sensible target.
- Lighting: one `ambientLight` (~0.4) + one `directionalLight` with shadows enabled.
- drei `<Grid>` (infinite grid, subtle colors) as the factory floor, plus a dark
  neutral background color (e.g. `#15171c`) — industrial look.

**Accept:** page shows a lit grid floor; orbit/zoom/pan works smoothly.

**Commit:** `feat: base 3D scene with camera, lighting and floor grid`

---

## Step 2 — Load and render the URDF arm

Create `src/sim/RobotArm.jsx`:
- Load `/6_dof_arm.urdf` with `urdf-loader` (use R3F's `useLoader` with `URDFLoader`,
  or a `useEffect` + manual `loader.load` storing the robot in state — either is fine,
  pick the one that avoids double-loading under StrictMode).
- Add the robot inside the shared Z-up group described in Context.
- Traverse the robot and set `castShadow`/`receiveShadow` on meshes.
- Expose the loaded robot object upward via a callback or a module-level ref
  (`src/sim/robotRef.js`) so the dashboard and sliders can read/write joints later.

**Accept:** the arm renders standing upright on the grid (base cylinder on the floor,
amber joint hubs visible, thin stylus at the top), roughly 1 m tall. No mirroring/
lying-on-its-side orientation bugs.

**Commit:** `feat: load stylus_arm URDF and render it in the scene`

---

## Step 3 — Render the 6-key test panel from key.config.json

Create `src/sim/KeyPanel.jsx`:
- `fetch('/key.config.json')` once; render one box per key **inside the same Z-up
  group as the robot**.
- Box size 0.04 × 0.04 × 0.02 m; position it so the **top face sits at the key's z**
  (i.e. box center at `z − 0.01`). Give the six keys distinct but cohesive colors, or
  one color with an emissive hover accent.
- Add a thin dark base plate under all six keys (simple box spanning them) so it reads
  as a panel, not floating cubes.
- Bonus (do it, it's cheap): drei `<Text>` digit labels "1"–"6" on each key's top face.
- Store the parsed key map in a module-level export (`src/sim/keyConfig.js` or a ref)
  for later phases.

**Accept:** six labeled keys sit on a small panel on the floor next to the arm, at
x 0.50–0.60 m, y ±0.05 m, tops at z = 0.05 m — verify one key by clicking with a
temporary console log of its world position if unsure.

**Commit:** `feat: render 6-key test panel at coordinates from key.config.json`

---

## Step 4 — Live dashboard (joint angles + stylus tip position)

Create `src/dashboard/Dashboard.jsx` (regular DOM, overlaid on the canvas with
absolute positioning — NOT inside `<Canvas>`):
- Shows all 7 joint names with current angle in **degrees** (1 decimal) and a small
  bar indicating position within that joint's URDF limits.
- Shows stylus tip position `X / Y / Z` in **meters, base frame** (3 decimals).
- Data flow: a tiny component inside the Canvas uses `useFrame` to write
  `{ jointAngles, tcp }` into a shared mutable ref every frame (no React state).
  The Dashboard reads that ref on a `setInterval` of 100 ms and setStates — live
  updates without 60 fps re-renders.
- TCP in base frame: get `robot.links['stylus_tip'].getWorldPosition(v)`, then convert
  with `robot.worldToLocal(v)` (the robot object's local frame IS `base_link`'s frame).

**Accept:** dashboard panel shows 7 joints at 0.0° and a TCP readout ≈
`(0, 0, 1.497)` — the arm fully extended upward (sum of link offsets:
0.06 + 0.25 + 0.25 + 0.25 + 0.15 + 0.25 + 0.15 + 0.137). If Z reads ~1.497, FK and the
frame conversion are proven correct — mention this number in the demo.

**Commit:** `feat: live dashboard showing joint angles and stylus tip position`

---

## Step 5 — Joint sliders (demo posing + proves "updating live")

Add a "Joint Control" section to the dashboard: one slider per joint, range = that
joint's URDF `lower`/`upper` limits (read them from the loaded robot's
`robot.joints[name].limit`), step 0.01 rad, displayed in degrees.
On input: `robot.setJointValue(name, radians)`. Add a **"Home" button** resetting all
joints to 0 and a **"Demo pose" button** setting a nice bent pose (e.g. J2 = −45°,
J3 = 60°, J5 = 30°) so the arm looks alive the moment judges walk up.

**Accept:** dragging any slider moves the arm in real time AND the angle readout +
TCP position update live — this single interaction demonstrates the entire Phase 1
rubric line ("joint states visible and updated live").

**Commit:** `feat: joint sliders with live arm posing, home and demo poses`

---

## Step 6 — Visual polish pass

- Soft shadows, slightly stronger key light, subtle `<Environment preset="city">`
  from drei if it doesn't tank performance.
- Dashboard styling: dark translucent panel, monospace numbers, small colored status
  dot ("SIMULATION LIVE"). Keep it clean — judges see this first.
- A small ground shadow/contact patch under the arm and panel.
- Title bar: project name + "Phase 1 — Visualization".

**Accept:** looks like a product screenshot, still 60 fps on the demo laptop.

**Commit:** `style: lighting, shadows and dashboard polish for judging demo`

---

## Step 7 — README

Short README: what Phase 1 delivers, stack choices (Vite/React/R3F/drei/urdf-loader),
the Z-up group trick, the `stylus_tip` frame-conversion note, how to run, and a
screenshot placeholder.

**Commit:** `docs: Phase 1 README with setup and architecture notes`

---

## Known pitfalls (check these if something looks wrong)

1. **Arm lying on its side / keys floating in the wrong plane** → the Z-up group is
   missing or the panel was placed outside it. Robot and panel must share the group.
2. **Robot loads twice / WebGL warnings in dev** → React StrictMode double-invokes
   effects; guard the manual loader with a ref or use `useLoader`.
3. **Dashboard frozen at 0°** → you're reading a stale copy of joints; read from the
   live `robot.joints[name].angle` inside `useFrame`, not from a snapshot taken at load.
4. **TCP numbers look world-frame (Y-up-ish)** → missing `robot.worldToLocal`
   conversion.
5. **urdf-loader import** — the package's default export is the loader class:
   `import URDFLoader from 'urdf-loader'`.
