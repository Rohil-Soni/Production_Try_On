# The Eye Wear Try-On — 8th Wall Production Plan

> **For Hermes:** Use teaching-first approach (interaction-style skill) when executing. Every step must be explained, demonstrated, and explicitly approved before any action.

**Goal:** Build a production-grade virtual glasses try-on using 8th Wall (open source) + Three.js, deployable as an embedded web page. Must match Meta/Lenskart realism — no sticker effect, proper PBR reflections, smooth tracking, auto-sizing from face measurements.

**Architecture:** 8th Wall engine provides AR camera pipeline + face tracking (`XR8.FaceController`). Three.js renders glasses with `MeshPhysicalMaterial` and HDR environment lighting. Pure-math layer (`computeScaleFactors`, `GlassesScaleFactors`) handles face-measurement-to-glasses-scaling. All orchestrated by a `GlassesSceneManager` that ties tracking pose → model position → materials → occlusion.

**Tech Stack:** 8th Wall Engine (open source, CDN-loaded), Three.js, TypeScript, Vite, GLB glasses models.

**Deployment Target:** Embedded `<iframe>` on a web page. Must work on iOS Safari & Android Chrome.

---

## Sprint 1: Foundation & Core AR Pipeline

> **Duration:** ~5-7 tasks, each 2-5 min of focused work.
> **Goal:** Camera opens, face is tracked, a test object (cube) follows the nose.

### Sprint 1 — Task 1: Create project scaffolding

**Objective:** Initialize the project folder, Git, package.json, TypeScript config, and Vite config.

**Files:**
- Create: `~/Code_Repo/Glasses-tryon/`
- Create: `~/Code_Repo/Glasses-tryon/package.json`
- Create: `~/Code_Repo/Glasses-tryon/tsconfig.json`
- Create: `~/Code_Repo/Glasses-tryon/vite.config.ts`
- Create: `~/Code_Repo/Glasses-tryon/.gitignore`
- Create: `~/Code_Repo/Glasses-tryon/public/models/` (folder)

**Step 1: Create project directory and initialize Git**

Run:
```bash
mkdir -p ~/Code_Repo/Glasses-tryon/public/models
cd ~/Code_Repo/Glasses-tryon
git init
```

Expected: Empty project with Git initialized.

**Step 2: Create `package.json`**

```json
{
  "name": "the-eye-wear-try-on",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@types/three": "^0.182.0",
    "typescript": "~5.9.3",
    "vite": "^7.2.4"
  },
  "dependencies": {
    "three": "^0.182.0",
    "three-stdlib": "^2.36.1"
  }
}
```

Note: 8th Wall is loaded via CDN script tag, not npm. No npm dependency needed.

**Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

**Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,   // Don't inline GLB files
  },
});
```

**Step 5: Install dependencies**

Run: `npm install`

Expected: node_modules/ created, package-lock.json created.

**Step 6: Commit**

```bash
git add package.json tsconfig.json vite.config.ts .gitignore
git commit -m "chore: initial project scaffolding"
```

**Verification:** `npm run dev` should start Vite dev server (will error on missing index.html — that's expected for now).

---

### Sprint 1 — Task 2: Create index.html (8th Wall entry)

**Objective:** Create the HTML entry point that loads 8th Wall SDK and our TypeScript app.

**Files:**
- Create: `index.html`

**Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>The Eye Wear Try-On</title>
  <style>
    /* Reset + full-screen for AR */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #renderer-container { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="renderer-container"></div>
  <!-- 8th Wall Engine binary (open source, CDN-loaded) -->
  <script
    src="https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js"
    async
    crossorigin="anonymous"
    data-preload-chunks="slam,face"
  ></script>
  <!-- Our app entry point -->
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**What each line does:**
- `<meta name="viewport" ... user-scalable=no>` — prevents pinch-zoom which breaks AR UX on mobile
- `overflow: hidden` — hides scrollbars so AR fills screen
- `<div id="renderer-container">` — Three.js will inject its `<canvas>` here
- `<script src="...engine-binary...">` — loads 8th Wall engine; `data-preload-chunks="slam,face"` tells it to pre-load SLAM tracking and face tracking modules
- `<script type="module" src="/src/main.ts">` — Vite serves this as an ES module with hot reload

**Verification:** `npm run dev` should serve the page (will show black screen until main.ts is created).

**Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add index.html with 8th Wall CDN"
```

---

### Sprint 1 — Task 3: Create src/ar-pipeline.ts (8th Wall initialization)

**Objective:** Encapsulate 8th Wall AR setup + face tracking into a reusable module.

**Files:**
- Create: `src/ar-pipeline.ts`

**Step 1: Create `src/ar-pipeline.ts`**

```ts
/**
 * ar-pipeline.ts
 *
 * Initializes 8th Wall WebAR with face tracking.
 * Exposes a clean API: createARPipeline(container) → { scene, camera, renderer, start, stop, onFaceUpdate }
 */

import * as THREE from 'three';

// 8th Wall is loaded globally via CDN script tag
declare const XR8: any;

// Pipeline modules needed for face-tracking AR
const FACE_PIPELINE_MODULES = [
  XR8.GlTextureRenderer(),     // Renders camera feed to a WebGL texture
  XR8.DeviceController(),      // Handles device orientation / motion
  XR8.CameraPipelineModule(),  // Core camera pipeline
  XR8.FaceController({         // Face tracking
    maxFaces: 1,
    enableLandmarks: true,     // 468 face landmarks (same indices as MediaPipe)
  }),
];

export interface ARPipeline {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Callback fired every frame with face tracking data */
  onFaceUpdate: ((frame: any) => void) | null;
  /** Start the AR session (requires app key) */
  start: () => void;
  /** Stop the AR session */
  stop: () => void;
}

export function createARPipeline(container: HTMLElement): ARPipeline {
  // ---- Three.js Renderer ----
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,              // Transparent background (camera shows through)
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // ---- Scene & Camera ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  );

  let running = false;

  const api: ARPipeline = {
    scene,
    camera,
    renderer,
    onFaceUpdate: null,

    start() {
      if (running) return;
      console.log('[ARPipeline] Starting 8th Wall session...');

      XR8.run({
        appKey: 'YOUR_APP_KEY',       // Replace with actual key for production
        modules: FACE_PIPELINE_MODULES,
        onReady: () => {
          running = true;
          console.log('[ARPipeline] 8th Wall session ready.');
        },
      });

      // Hook into per-frame update to extract face pose
      XR8.addCameraPipelineModule({
        name: 'glasses-renderer',
        onUpdate: ({ frame }: { frame: any }) => {
          if (api.onFaceUpdate) {
            api.onFaceUpdate(frame);
          }
        },
      });
    },

    stop() {
      if (!running) return;
      XR8.stop();
      running = false;
      console.log('[ARPipeline] Session stopped.');
    },
  };

  // Handle window resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return api;
}
```

**Key concepts to teach:**
- `declare const XR8: any` — tells TypeScript "trust us, this global exists at runtime" (loaded via CDN script)
- `XR8.FaceController({ maxFaces: 1, enableLandmarks: true })` — enables face tracking with 468 landmarks
- `onUpdate: ({ frame }) => { ... }` — 8th Wall's per-frame callback; `frame.worldTransform` contains the 4×4 face pose matrix
- `THREE.ACESFilmicToneMapping` — film-like contrast curve for realistic rendering

**Verification:** `npm run dev` should compile without TypeScript errors. (No visual change yet — main.ts not created.)

**Step 2: Commit**

```bash
git add src/ar-pipeline.ts
git commit -m "feat: add 8th Wall AR pipeline module"
```

---

### Sprint 1 — Task 4: Create src/main.ts (app entry + test cube)

**Objective:** Wire everything together — create Three.js scene, add a test cube that follows the face, render loop.

**Files:**
- Create: `src/main.ts`
- Create: `src/style.css`

**Step 1: Create `src/style.css`**

```css
/* Minimal reset — AR controls its own full-screen layout */
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
```

**Step 2: Create `src/main.ts`**

```ts
/**
 * main.ts — App entry point
 *
 * 1. Creates the 8th Wall AR pipeline
 * 2. Adds a test cube (green sphere) that follows face pose
 * 3. Starts the render loop
 */

import './style.css';
import { createARPipeline } from './ar-pipeline.ts';

// ---- Bootstrap ----
const container = document.getElementById('renderer-container')!;

if (!container) {
  throw new Error('Renderer container not found. Check index.html for <div id="renderer-container">');
}

const pipeline = createARPipeline(container);

// ---- Test Object: Green Sphere at nose position ----
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.02, 16, 16),  // 2cm radius
  new THREE.MeshBasicMaterial({ color: 0x00ff66 }),
);
sphere.visible = false;   // Hidden until face detected
pipeline.scene.add(sphere);

// ---- Face Tracking Callback ----
pipeline.onFaceUpdate = (frame: any) => {
  const pose = frame?.worldTransform;

  if (!pose) {
    sphere.visible = false;
    return;
  }

  sphere.visible = true;

  // Convert 8th Wall's Float32Array(16) to Three.js Matrix4
  const matrix = new THREE.Matrix4().fromArray(pose);

  // Decompose into position and rotation
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  matrix.decompose(position, quaternion, new THREE.Vector3());

  sphere.position.copy(position);
  sphere.quaternion.copy(quaternion);

  // Sync Three.js camera with 8th Wall's AR camera
  if (frame.cameraProjectionMatrix) {
    pipeline.camera.projectionMatrix.fromArray(frame.cameraProjectionMatrix);
  }
  if (frame.cameraViewMatrix) {
    pipeline.camera.matrixWorldInverse.fromArray(frame.cameraViewMatrix);
  }
};

// ---- Render Loop ----
function animate() {
  requestAnimationFrame(animate);
  pipeline.renderer.render(pipeline.scene, pipeline.camera);
}
animate();

// ---- Start AR ----
pipeline.start();

// ---- Debug helpers (console) ----
(window as any).__pipeline = pipeline;
console.log('[App] Ready. Face the camera to see the test sphere.');
```

**What to teach:**
- `pipeline.onFaceUpdate` — gets called every frame by 8th Wall; `frame.worldTransform` is a 4×4 matrix
- `new THREE.Matrix4().fromArray(pose)` — converts 8th Wall's flat Float32Array to Three.js matrix
- `.decompose(position, quaternion, scale)` — extracts position + rotation from the matrix
- Camera sync: 8th Wall provides its own projection + view matrices which we copy to Three.js camera for correct AR perspective
- Render loop: `requestAnimationFrame(animate)` — standard Three.js pattern

**Verification:**
Run: `npm run dev`
Expected: Browser asks for camera permission. Green sphere appears on nose and follows head movement.

**Step 3: Commit**

```bash
git add src/main.ts src/style.css
git commit -m "feat: add app entry with face-tracked test sphere"
```

---

### Sprint 1 — Task 5: Configure for embedded deployment

**Objective:** Ensure the app can be embedded in an `<iframe>` on any webpage (no hardcoded size, responsive to container).

**Files:**
- Modify: `src/main.ts` (use container size, not viewport)
- Already done — `createARPipeline` takes a container element

**Key considerations to teach:**
- For iframe embedding, the container `div` is sized by the parent page via CSS
- `renderer.setSize(container.clientWidth, container.clientHeight)` ensures it fills whatever space is given
- `resize` event listener handles container size changes
- No hardcoded widths/heights anywhere

**Verification:**
- Create a simple test HTML that embeds the app in an iframe
- The AR scene should fill the iframe without breaking out

**Step 1: Commit**

```bash
git add .
git commit -m "feat: responsive container sizing for embed"
```

---

### Sprint 1 — Task 6: Git push (first remote push)

**Objective:** Push Sprint 1 foundation to GitHub.

**Step 1: Create GitHub repo**

- Go to github.com, create new repo named `the-eye-wear-try-on`
- Do NOT initialize with README (we already have one)

**Step 2: Push**

```bash
git remote add origin https://github.com/YOUR_USERNAME/the-eye-wear-try-on.git
git branch -M main
git push -u origin main
```

**Verification:** Repo visible on GitHub with all Sprint 1 files.

---

## Sprint 2: Glasses Rendering & Auto-Scaling

> **Duration:** ~6-8 tasks
> **Goal:** Realistic glasses model appears on face, auto-sizes from face measurements, PBR materials look real, tracking is smooth.

### Sprint 2 — Task 1: Create GlassesScaleFactors.ts (pure type definitions)

**Objective:** Re-create the type definitions file (from memory of the old project — engine-agnostic, zero dependencies).

**Files:**
- Create: `src/GlassesScaleFactors.ts`

**Complete code:**

```ts
/** All face measurements in millimeters */
export interface FaceMeasurements {
  faceWidth: number;         // temple to temple (mm)
  pupillaryDist: number;     // pupil to pupil (PD)
  noseBridgeWidth: number;   // nose bridge width
  earToEar: number;          // ear to ear over head
  noseBridgeHeight: number;  // nose bridge height
}

/** Reference dimensions of the 3D glasses model (measure in Blender) */
export interface ModelDimensions {
  frameWidth: number;    // overall frame width
  bridgeWidth: number;   // bridge/nose piece width
  lensWidth: number;     // individual lens width
  lensHeight: number;    // individual lens height
  templeLength: number;  // temple arm length
  nosePadGap: number;    // nose pad height/gap
}

export interface ScaleVector { x: number; y: number; z: number; }

export interface ScaleFactors {
  frame: ScaleVector;
  bridge: ScaleVector;
  temple: ScaleVector;
  nosePad: ScaleVector;
}

export interface GlassesPartNames {
  frame?: string;
  bridge?: string;
  templeLeft?: string;
  templeRight?: string;
  nosePadLeft?: string;
  nosePadRight?: string;
  glassesRoot?: string;
}
```

**Verification:** TypeScript compiles without errors.

**Commit:** `git add src/GlassesScaleFactors.ts && git commit -m "feat: add glasses scale type definitions"`

---

### Sprint 2 — Task 2: Create computeScaleFactors.ts (pure math)

**Objective:** Port the formula engine — converts face measurements → scale factors.

**Files:**
- Create: `src/computeScaleFactors.ts`

**Complete code:**

```ts
import type { FaceMeasurements, ModelDimensions, ScaleFactors } from './GlassesScaleFactors';

const CLEARANCE_MM = 16; // 8mm each side for natural fit

export function computeScaleFactors(face: FaceMeasurements, model: ModelDimensions): ScaleFactors {
  const Sx = (face.faceWidth - CLEARANCE_MM) / model.frameWidth;
  const Sy = Sx;  // keep aspect ratio
  const Sz = face.faceWidth / model.frameWidth;

  return {
    frame:  { x: Sx, y: Sy, z: Sz },
    bridge: { x: face.noseBridgeWidth / model.bridgeWidth, y: Sy, z: Sz },
    temple: { x: Math.max((face.earToEar/2 - (model.frameWidth*Sx)/2) / model.templeLength, 0.3), y: Sy, z: Sz },
    nosePad:{ x: Sx, y: face.noseBridgeHeight / model.nosePadGap, z: Sz },
  };
}

export function validateScaleFactors(f: ScaleFactors): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [name, v] of Object.entries(f)) {
    if (v.x < 0.1 || v.x > 3.0) errors.push(`${name}.x out of bounds`);
    if (v.y < 0.1 || v.y > 3.0) errors.push(`${name}.y out of bounds`);
    if (v.z < 0.1 || v.z > 3.0) errors.push(`${name}.z out of bounds`);
  }
  return { valid: errors.length === 0, errors };
}
```

**Teach:** Pure function — no DOM, no Three.js, testable in isolation. Same formulas as Lenskart/Meta use for frame fitting.

**Verification:** TypeScript compiles.

**Commit:** `git add src/computeScaleFactors.ts && git commit -m "feat: add face-to-glasses scale computation"`

---

### Sprint 2 — Task 3: Create GlassesFitter.ts (Three.js loader + scaler)

**Objective:** Load GLB models and apply per-part scaling from centroids (prevents mesh drift).

**Files:**
- Create: `src/GlassesFitter.ts`

**Complete code:**

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import type { ScaleFactors, GlassesPartNames } from './GlassesScaleFactors';

export class GlassesFitter {
  private scene: THREE.Group;
  private parts = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Group) { this.scene = scene; this.indexParts(); }

  static async fromURL(url: string): Promise<GlassesFitter> {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new GlassesFitter(gltf.scene);
  }

  private indexParts() {
    this.parts.clear();
    this.scene.traverse(obj => { if (obj.name) this.parts.set(obj.name, obj); });
  }

  applyScaleFactors(factors: ScaleFactors, names: GlassesPartNames = {}) {
    const defaults = { frame:'Frame', bridge:'Bridge', templeLeft:'Temple_L', templeRight:'Temple_R', nosePadLeft:'NosePad_L', nosePadRight:'NosePad_R' };
    const n = { ...defaults, ...names };

    this.scalePart(n.frame,       factors.frame);
    this.scalePart(n.bridge,      factors.bridge);
    this.scalePart(n.templeLeft,  factors.temple);
    this.scalePart(n.templeRight, factors.temple);
    this.scalePart(nosePadLeft,   factors.nosePad);
    this.scalePart(nosePadRight,  factors.nosePad);
  }

  /** Scale a part from its centroid (prevents position drift) */
  private scalePart(name: string, scale: { x: number; y: number; z: number }) {
    const obj = this.parts.get(name);
    if (!obj) return console.warn(`[GlassesFitter] Part "${name}" not found`);
    const box = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box.getCenter(c);
    obj.position.sub(c);
    obj.scale.multiply(new THREE.Vector3(scale.x, scale.y, scale.z));
    obj.position.add(c);
    obj.position.multiply(new THREE.Vector3(scale.x, scale.y, scale.z));
  }

  getScene() { return this.scene; }
  listParts() { return Array.from(this.parts.keys()).sort(); }
  hasPart(name: string) { return this.parts.has(name); }
  getPart(name: string) { return this.parts.get(name); }
}
```

**Teach:** Centroid-based scaling — without this, scaling a part that's offset from origin causes it to "drift" sideways. By subtracting centroid → scale → adding centroid back, the part stays in place.

**Verification:** TypeScript compiles.

**Commit:** `git add src/GlassesFitter.ts && git commit -m "feat: add GLB loader with centroid-based per-part scaling"`

---

### Sprint 2 — Task 4: Create GlassesRenderer + wire into main.ts

**Objective:** Replace the test sphere with the actual glasses model. Load GLB, attach to face pose, apply scale factors.

**Files:**
- Create: `src/glasses-renderer.ts`
- Modify: `src/main.ts` (replace sphere with glasses)
- Need: glasses GLB model in `public/models/`

**Step 1: Create `src/glasses-renderer.ts`**

```ts
import * as THREE from 'three';
import { GlassesFitter } from './GlassesFitter';
import { computeScaleFactors, validateScaleFactors } from './computeScaleFactors';
import type { FaceMeasurements, ModelDimensions } from './GlassesScaleFactors';

export class GlassesRenderer {
  root = new THREE.Group();
  private fitter: GlassesFitter | null = null;
  private offset = new THREE.Vector3();
  private modelDimensions?: ModelDimensions;

  async loadModel(url: string, modelDims: ModelDimensions) {
    this.modelDimensions = modelDims;
    this.fitter = await GlassesFitter.fromURL(url);
    this.root.add(this.fitter.getScene());
  }

  updateFromFace(measurements: FaceMeasurements, poseMatrix: THREE.Matrix4) {
    if (!this.fitter || !this.modelDimensions) return;

    // Compute scale factors from face measurements
    const factors = computeScaleFactors(measurements, this.modelDimensions);
    const validation = validateScaleFactors(factors);
    if (validation.valid) {
      this.fitter.applyScaleFactors(factors);
    }

    // Apply face pose
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    poseMatrix.decompose(pos, quat, new THREE.Vector3());
    this.root.position.copy(pos).add(this.offset);
    this.root.quaternion.copy(quat);
  }

  setOffset(x: number, y: number, z: number) { this.offset.set(x, y, z); }
}
```

**Step 2: Update `src/main.ts`** — replace sphere with `GlassesRenderer`

```ts
import { GlassesRenderer } from './glasses-renderer';

const glasses = new GlassesRenderer();
pipeline.scene.add(glasses.root);

// Load the glasses model
const MODEL_DIMS = { frameWidth:140, bridgeWidth:18, lensWidth:52, lensHeight:40, templeLength:145, nosePadGap:12 };
glasses.loadModel('/models/glassesbonesfinal.glb', MODEL_DIMS);

pipeline.onFaceUpdate = (frame: any) => {
  if (!frame?.worldTransform) { glasses.root.visible = false; return; }
  glasses.root.visible = true;
  const matrix = new THREE.Matrix4().fromArray(frame.worldTransform);
  // For now, pass placeholder measurements (will wire real landmarks later)
  glasses.updateFromFace(
    { faceWidth:0.14, pupillaryDist:0.063, noseBridgeWidth:0.02, earToEar:0.30, noseBridgeHeight:0.025 },
    matrix,
  );
  // Camera sync (same as before)
};
```

**Verification:** Glasses appear on face (may be mis-sized until real landmarks are wired).

**Commit:** `git add src/glasses-renderer.ts src/main.ts && git commit -m "feat: add glasses renderer with auto-scaling"`

---

### Sprint 2 — Task 5: Wire face landmarks → measurements → auto-scale

**Objective:** Use 8th Wall's 468 face landmarks to compute actual face measurements, feeding them into `computeScaleFactors`.

**Files:**
- Create: `src/face-metrics.ts`
- Modify: `src/main.ts` (use real measurements)

**Step 1: Create `src/face-metrics.ts`**

```ts
import type { FaceMeasurements } from './GlassesScaleFactors';
import * as THREE from 'three';

/** Extract face measurements from 8th Wall landmarks array */
export function computeFaceMeasurements(landmarks: number[][]): FaceMeasurements | null {
  if (!landmarks || landmarks.length < 455) return null;

  const dist = (a: number, b: number) => {
    const dx = landmarks[a][0] - landmarks[b][0];
    const dy = landmarks[a][1] - landmarks[b][1];
    const dz = landmarks[a][2] - landmarks[b][2];
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  };

  // Key landmark indices (same as MediaPipe)
  // 168=nose bridge, 234=left temple, 454=right temple
  // 33=left eye outer, 263=right eye outer
  // 130=left eye inner, 359=right eye inner
  // 10=forehead, 152=chin

  const faceWidth = dist(234, 454);
  const eyeDist = dist(33, 263);
  const noseBridgeW = dist(130, 359);
  const faceHeight = dist(10, 152);

  // Approximate ear-to-ear from face width (hard to measure directly from landmarks)
  const earToEar = faceWidth * 1.15;

  return {
    faceWidth,
    pupillaryDist: eyeDist,
    noseBridgeWidth: noseBridgeW,
    earToEar,
    noseBridgeHeight: dist(168, 6),  // nose bridge to nose tip
  };
}
```

**Step 2: Update `main.ts`**

```ts
import { computeFaceMeasurements } from './face-metrics';

pipeline.onFaceUpdate = (frame: any) => {
  if (!frame?.worldTransform || !frame.faceData?.landmarks) {
    glasses.root.visible = false;
    return;
  }
  glasses.root.visible = true;

  const matrix = new THREE.Matrix4().fromArray(frame.worldTransform);
  const measurements = computeFaceMeasurements(frame.faceData.landmarks);

  if (measurements) {
    glasses.updateFromFace(measurements, matrix);
  } else {
    // Fall back to pose-only (no scaling update)
    glasses.updateFromFace(
      { faceWidth:0.14, pupillaryDist:0.063, noseBridgeWidth:0.02, earToEar:0.30, noseBridgeHeight:0.025 },
      matrix,
    );
  }

  // Camera sync
  if (frame.cameraProjectionMatrix) pipeline.camera.projectionMatrix.fromArray(frame.cameraProjectionMatrix);
  if (frame.cameraViewMatrix) pipeline.camera.matrixWorldInverse.fromArray(frame.cameraViewMatrix);
};
```

**Verification:** Glasses auto-size to your face. Turn head — glasses stay on nose bridge.

**Commit:** `git add src/face-metrics.ts && git commit -m "feat: wire face landmarks to auto-scaling"`

---

### Sprint 2 — Task 6: PBR materials + HDR environment lighting

**Objective:** Replace basic materials with MeshPhysicalMaterial — real metalness, roughness, transparent lenses with Fresnel, and environment reflections.

**Files:**
- Create: `src/hdr-environment.ts`
- Create: `src/glasses-materials.ts`
- Modify: `src/glasses-renderer.ts` (apply materials after load)

**Step 1: `src/hdr-environment.ts`**

```ts
import * as THREE from 'three';

export function setupEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();

  // Neutral studio-style environment
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x888899);
  const envMap = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
  scene.environment = envMap;
  pmrem.dispose();
}
```

**Step 2: `src/glasses-materials.ts`**

```ts
import * as THREE from 'three';

export function applyPBRMaterials(root: THREE.Group) {
  root.traverse((child: any) => {
    if (!child.isMesh) return;
    const name = child.name.toLowerCase();
    const isLens = name.includes('lens') || name.includes('glass');
    const isTemple = name.includes('temple') || name.includes('arm');
    const isNosePad = name.includes('nosepad') || name.includes('nose_pad');

    child.material = new THREE.MeshPhysicalMaterial({
      color: isLens ? new THREE.Color(0x88ccff) : new THREE.Color(0x1a1a1a),
      metalness: isLens ? 0 : (isTemple ? 0.2 : 0.4),
      roughness: isLens ? 0 : (isTemple ? 0.7 : 0.5),
      transparent: isLens,
      opacity: isLens ? 0.15 : 1.0,
      envMapIntensity: isLens ? 0.5 : 0.8,
      clearcoat: isLens ? 0 : 0.15,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide,
      depthWrite: !isLens,
      ...(isLens && { ior: 1.45, transmission: 0.1, thickness: 1.5 }),
    });
  });
}
```

**Step 3: Wire into `glasses-renderer.ts`**

```ts
import { setupEnvironment } from './hdr-environment';
import { applyPBRMaterials } from './glasses-materials';

// In the constructor or after load:
async loadModel(url: string, modelDims: ModelDimensions, renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  await this._loadModel(url, modelDims);
  setupEnvironment(renderer, scene);
  applyPBRMaterials(this.root);
}
```

**Verification:** Glasses have realistic material appearance — dark metal frame, transparent blue-tinted lenses with reflections that change as you move.

**Commit:** `git add src/hdr-environment.ts src/glasses-materials.ts && git commit -m "feat: add PBR materials and HDR environment"`

---

### Sprint 2 — Task 7: Tracking smoothing (jitter reduction)

**Objective:** Implement confidence-weighted lerp for position and slerp for rotation to eliminate jitter.

**Files:**
- Create: `src/tracking-filter.ts`
- Modify: `src/main.ts` (apply filter before passing pose to glasses)

**Step 1: `src/tracking-filter.ts`**

```ts
import * as THREE from 'three';

export class TrackingFilter {
  private smoothPos = new THREE.Vector3();
  private smoothQuat = new THREE.Quaternion();
  private initialized = false;

  filter(pos: THREE.Vector3, quat: THREE.Quaternion, confidence: number): { pos: THREE.Vector3; quat: THREE.Quaternion } {
    if (!this.initialized) {
      this.smoothPos.copy(pos);
      this.smoothQuat.copy(quat);
      this.initialized = true;
      return { pos, quat };
    }
    const alpha = 0.12 + confidence * 0.28; // More confidence = faster tracking
    this.smoothPos.lerp(pos, alpha);
    this.smoothQuat.slerp(quat, alpha);
    return { pos: this.smoothPos, quat: this.smoothQuat };
  }

  reset() { this.initialized = false; }
}
```

**Teach:** `lerp` = linear interpolation. `slerp` = spherical linear interpolation (for rotations). Both produce smooth motion by blending between old and new values. Higher confidence = more weight on new data = faster response.

**Commit:** `git add src/tracking-filter.ts && git commit -m "feat: add confidence-weighted tracking smoothing"`

---

### Sprint 2 — Task 8: Add real 3D glasses model(s)

**Objective:** Obtain and place production-quality glasses models into the project.

**Files:**
- Add: `public/models/` — GLB files

**Options (to discuss with user):**
1. Use existing models from old project (if available from backup)
2. Download free CC-licensed glasses models (Sketchfab, Poly Haven)
3. Create simple placeholder in Blender

**Verification:** `glassesbonesfinal.glb` loads without errors in browser console.

**Commit:** `git add public/models/ && git commit -m "feat: add glasses 3D models"`

---

## Sprint 3: Production Polish & Deployment

> **Duration:** ~5-7 tasks
> **Goal:** Dynamic occlusion, frame selector UI, calibration UI, responsive embed, deployment.

### Sprint 3 — Task 1: Dynamic occlusion (temple fade on head turn)

**Objective:** When head turns past ~10°, the far-side temple fades. Port logic from old `main.ts` occlusion system.

**Files:**
- Create: `src/occlusion-manager.ts`
- Modify: `src/glasses-renderer.ts` (call update each frame)

**Key code (occlusion logic):**

```ts
export class OcclusionManager {
  private rightParts: THREE.Object3D[] = [];
  private leftParts: THREE.Object3D[] = [];

  detectParts(root: THREE.Group) {
    root.traverse((child: any) => {
      if (!child.isMesh) return;
      const name = child.name.toLowerCase();
      if (/right|_r|\.r/.test(name) && /temple|stem|arm/.test(name)) this.rightParts.push(child);
      if (/left|_l|\.l/.test(name) && /temple|stem|arm/.test(name)) this.leftParts.push(child);
    });
  }

  update(yawDeg: number) {
    const fade = (v: number) => Math.max(0, Math.min(1, (v - 10) / 18));
    this._setOpacity(this.rightParts, 1 - fade(yawDeg) * 0.96);
    this._setOpacity(this.leftParts,  1 - fade(-yawDeg) * 0.96);
  }

  private _setOpacity(parts: THREE.Object3D[], opacity: number) {
    for (const p of parts) {
      const mesh = p as any;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) { m.opacity = opacity; m.transparent = true; }
    }
  }
}
```

**Teach:** The `smoothStep` at 10° to 28° means glasses look solid when facing forward, and the far temple fades gradually so it doesn't pop in/out. Mimics real-world occlusion where the temple goes behind the face.

**Commit:** `git add src/occlusion-manager.ts && git commit -m "feat: add dynamic temple occlusion on head turn"`

---

### Sprint 3 — Task 2: Calibration UI (position/scale per device)

**Objective:** Sliders for X/Y/Z position offset and scale factor. Saved per-device in localStorage.

**Files:**
- Create: `src/calibration-store.ts`
- Create: `src/calibration-ui.ts`
- Modify: `src/main.ts` (wire calibration into glasses offset)

**Step 1: `calibration-store.ts`**

```ts
const KEY_PREFIX = 'eye-wear-tryon-cal';

export interface CalibrationProfile {
  offsetX: number; offsetY: number; offsetZ: number;
  scale: number;
}

export function loadCalibration(): CalibrationProfile {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:${deviceId()}`);
    return raw ? JSON.parse(raw) : defaultProfile();
  } catch { return defaultProfile(); }
}

export function saveCalibration(profile: CalibrationProfile) {
  localStorage.setItem(`${KEY_PREFIX}:${deviceId()}`, JSON.stringify(profile));
}

function deviceId() {
  return `${screen.width}x${screen.height}:dpr${devicePixelRatio}`;
}

function defaultProfile(): CalibrationProfile {
  return { offsetX: 0, offsetY: 0, offsetZ: -0.15, scale: 1 };
}
```

**Step 2: `calibration-ui.ts`** — HTML overlay with sliders

Create a dark glassmorphism panel (similar to old project's style):

- Frame Size slider (40–220pt)
- Position X/Y/Z sliders (-0.05 to +0.05)
- Reset button
- Save/Load preset buttons

**Style:** Dark translucent, backdrop-filter blur, rounded corners. Mobile-responsive (narrow on phone).

**Commit:** `git add src/calibration-store.ts src/calibration-ui.ts && git commit -m "feat: add per-device calibration UI"`

---

### Sprint 3 — Task 3: Frame/style selector UI

**Objective:** Allow users to switch between multiple glasses models.

**Files:**
- Create: `src/frame-selector.ts`
- Modify: `src/main.ts` (wire frame switching)

**UI design:**
- Horizontal scrollable row at bottom of screen
- Each item = thumbnail image + label
- Tap to switch — unloads current model, loads new one
- Maintains current calibration offset

**Frame registry:**
```ts
const FRAMES = [
  { id: 'classic', label: 'Classic', path: '/models/glassesbonesfinal.glb' },
  { id: 'round',   label: 'Round',   path: '/models/glasses.glb' },
  { id: 'modern',  label: 'Modern',  path: '/models/glassesbonesfinal_2.glb' },
];
```

**Commit:** `git add src/frame-selector.ts && git commit -m "feat: add multi-frame selector UI"`

---

### Sprint 3 — Task 4: Responsive UI for embed

**Objective:** Ensure the entire experience works inside an `<iframe>` at any size (300×500 or full screen).

**Key patterns:**
- Use container element for sizing, not window
- CSS: `width: 100%; height: 100%;` on the container
- UI panel collapses to narrow version on small screens
- No fixed-position elements that break out of iframe
- Test with: `<iframe src="https://..." style="width:100%;max-width:400px;height:600px;border:none;">`

**Files:**
- Modify: `src/style.css` (responsive rules)
- Modify: `src/calibration-ui.ts` (narrow mode)

**Commit:** `git add src/style.css && git commit -m "fix: responsive layout for iframe embedding"`

---

### Sprint 3 — Task 5: Performance optimization

**Objective:** Ensure smooth 30+ FPS on mid-range phones.

**Files:**
- Modify: `src/ar-pipeline.ts`

**Optimizations:**
```ts
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x
renderer.setSize(Math.floor(w), Math.floor(h));               // Integer sizes
// Disable shadow maps (not needed for face try-on)
renderer.shadowMap.enabled = false;
```

- GLB optimization: Draco compression, quantized transforms
- Limit draw calls: Combine lens/glass meshes where possible

**Commit:** `git commit -m "perf: pixel ratio cap and shadow map disable"`

---

### Sprint 3 — Task 6: Production build & embed deployment

**Objective:** Configure build for iframe embedding and deploy.

**Files:**
- Modify: `vite.config.ts` (embed-friendly settings)

**Vite config:**
```ts
export default defineConfig({
  base: './',         // Relative paths (works in iframe on any domain)
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,    // Don't inline GLBs
    rollupOptions: {
      output: {
        manualChunks: {      // Separate chunk for 8th Wall
          'xr-engine': ['/src/ar-pipeline.ts'],
        },
      },
    },
  },
});
```

**Deploy targets:**
- `npm run build` → `dist/` folder
- Upload to any static host (Netlify, Vercel, GitHub Pages, S3)
- Embed via: `<iframe src="https://your-app.netlify.app/" style="width:100%;height:600px;border:none;">`

**Commit:** `git add vite.config.ts && git commit -m "chore: production build config for embed"`

---

### Sprint 3 — Task 7: README & documentation

**Objective:** Write comprehensive README covering setup, features, embed instructions.

**Files:**
- Create: `README.md`

**Sections:**
1. Project overview
2. Tech stack
3. Quick start (`npm install && npm run dev`)
4. Build & deploy
5. Embedding guide
6. Calibration instructions
7. Model format requirements
8. Architecture overview
9. Known limitations

**Commit:** `git add README.md && git commit -m "docs: add comprehensive README"`

---

### Sprint 3 — Task 8: Final push & deploy

**Objective:** Push all sprints to GitHub and deploy.

**Step 1: Push to GitHub**
```bash
git push -u origin main
```

**Step 2: Deploy to Netlify/Vercel**
- Connect GitHub repo
- Build command: `npm run build`
- Publish directory: `dist`

**Step 3: Test embed**
```html
<iframe
  src="https://the-eye-wear-try-on.netlify.app/"
  style="width:100%; max-width:450px; height:600px; border:none; border-radius:12px;"
  allow="camera;microphone"
></iframe>
```

**Verification:** Glasses try-on works inside iframe on both desktop and mobile browsers.

---

## Files Summary

### Kept from old project (pure logic, engine-agnostic)

| File | Purpose |
|------|---------|
| `src/GlassesScaleFactors.ts` | Type definitions |
| `src/computeScaleFactors.ts` | Math: face → scale factors |
| `src/GlassesFitter.ts` | Three.js GLB loader + scaler |

### New files to create

| File | Sprint | Purpose |
|------|--------|---------|
| `index.html` | S1-T2 | Entry page with 8th Wall CDN |
| `src/ar-pipeline.ts` | S1-T3 | 8th Wall initialization |
| `src/main.ts` | S1-T4 | App entry, render loop |
| `src/style.css` | S1-T4 | Minimal CSS reset |
| `src/face-metrics.ts` | S2-T5 | Landmark → measurements |
| `src/glasses-renderer.ts` | S2-T4 | Glasses lifecycle manager |
| `src/hdr-environment.ts` | S2-T6 | HDR env map setup |
| `src/glasses-materials.ts` | S2-T6 | PBR material application |
| `src/tracking-filter.ts` | S2-T7 | Jitter smoothing |
| `src/occlusion-manager.ts` | S3-T1 | Temple fade on head turn |
| `src/calibration-store.ts` | S3-T2 | Per-device localStorage |
| `src/calibration-ui.ts` | S3-T2 | HTML overlay UI |
| `src/frame-selector.ts` | S3-T3 | Multi-model picker |
| `package.json` | S1-T1 | Dependencies |
| `tsconfig.json` | S1-T1 | TypeScript config |
| `vite.config.ts` | S1-T1 | Vite config |
| `.gitignore` | S1-T1 | Git ignore rules |
| `README.md` | S3-T7 | Documentation |

### GLB models needed

| File | Source | Status |
|------|--------|--------|
| `public/models/glassesbonesfinal.glb` | Old project / backup | ❌ Need to obtain |
| `public/models/glasses.glb` | Old project / backup | ❌ Need to obtain |
| `public/models/glassesbonesfinal_2.glb` | Old project / backup | ❌ Need to obtain |

---

## Verification Checklist (all sprints)

- [ ] `npm install` succeeds with no errors
- [ ] `npm run dev` starts Vite server
- [ ] Camera permission prompt appears
- [ ] Green test sphere appears on nose (S1)
- [ ] Sphere disappears when face leaves frame (S1)
- [ ] Glasses model loads and tracks face (S2)
- [ ] Glasses auto-size to face (S2)
- [ ] PBR materials look realistic (S2)
- [ ] Tracking is smooth with no jitter (S2)
- [ ] Temple fades on head turn (S3)
- [ ] Calibration sliders affect glasses position/scale (S3)
- [ ] Calibration persists on reload (S3)
- [ ] Frame switching works (S3)
- [ ] `npm run build` exits 0 (S3)
- [ ] Works embedded in `<iframe>` on mobile (S3)
- [ ] Pushed to GitHub (S3)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 8th Wall open source license changes | Legal | Monitor 8thwall.org; code is framework-free, can switch to MediaPipe |
| GLB models don't have separate lens/frame parts | Can't apply per-part PBR | Split meshes in Blender (30 min work) |
| Mobile performance issues | Low FPS on older phones | Cap pixel ratio, optimize GLB with Draco compression |
| 8th Wall needs app key for production | Deploy blocked | Free tier available; no key needed for open source version |
| Embedding in iframe breaks camera access | App doesn't work embedded | Requires `allow="camera"` attribute on iframe + HTTPS |

---

## Open Questions for Discussion

1. **GLB models** — Do you have backup copies of the `.glb` files from the old project? If not, should we download free CC-licensed glasses models or create simple placeholders?
2. **GitHub repo name** — Should it be `the-eye-wear-try-on` or something shorter?
3. **App key** — 8th Wall's open source engine may need an app key for the face tracking binary. Shall we sign up for a free account at 8thwall.org when we reach deployment?
4. **Embed target** — Which website/page will embed this? Knowing the target dimensions helps optimize the responsive UI.
5. **Frame styles** — For the frame selector, should we aim for 3 distinct styles (classic, round, modern) or more?
