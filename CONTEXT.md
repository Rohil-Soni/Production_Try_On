# The Eye Wear Try-On — Project Context & Plan

> AR glasses try-on web app built with the **8th Wall open-source engine** + **Three.js** + **Vite + TypeScript**.
> Project root: `/home/Rohil-Arch/Code_Repo/Glasses-tryon`

---

## 1. What This Project Is

A web-based virtual try-on experience: the user opens the page, allows camera access,
and sees a 3D glasses model (`.glb`) overlaid on their face in real time, tracked by
8th Wall's face/AR pipeline.

**Stack:**

| Layer | Tech |
|---|---|
| AR engine | 8th Wall open-source engine (`@8thwall/engine-binary@1` via CDN) |
| 3D rendering | Three.js (`three`, `three-stdlib`) |
| Build tool | Vite 7 + TypeScript (strict) |
| Asset | `public/models/glasses.glb` |

---

## 2. Background: 8th Wall Open-Source Transition (Feb 2026)

- Niantic retired the hosted 8th Wall platform (console, app keys, cloud editor) on **Feb 28, 2026**.
- The engine is now open-source: `8thwall.org` / `github.com/8thwall/8thwall`.
- **No app key, no account, no console** — the `appKey` field is gone from `XR8.run()`.
- SLAM remains a separately-distributed closed binary (`8th.io/xrjs`) under a limited-use license;
  Face Effects is MIT. Check SLAM licensing if the product goes commercial.
- SDK is pulled from: `https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js`

**Old vs New API:**

| Old (hosted) | New (open source) |
|---|---|
| `XR8.run({ appKey: '...', modules, onReady, onError })` | `XR8.addCameraPipelineModules([...])` then `XR8.run({ canvas })` |
| Modules passed inside `run()` | Modules registered separately |
| `onReady`/`onError` callbacks exist | No such callbacks — "ready" = your module's `onStart` fires |

---

## 3. File Map

```
Glasses-tryon/
├── index.html                      # Entry HTML (XRExtras script + #renderer-container)
├── vite.config.ts                  # base './', port 5500 strict
├── tsconfig.json                   # strict, ESNext modules
├── package.json                    # three, three-stdlib, typescript, vite
├── public/
│   ├── models/glasses.glb          # 3D glasses model
│   └── camera-diagnostic.html      # Standalone getUserMedia test page
└── src/
    ├── main.ts                     # "Try On" tap overlay → pipeline.start()
    ├── ar-pipeline.ts              # 8th Wall engine load + pipeline modules + glasses-updater
    ├── GlassesFitter.ts            # GLB loader + per-part scaling
    ├── GlassesScaleFactors.ts      # ScaleFactors / part-name types
    ├── computeScaleFactors.ts      # face measurements → scale factors (pure math)
    ├── face-metrics.ts             # landmarks → FaceMeasurements
    ├── glasses-renderer.ts         # material setup (lens transparency, frame metal)
    └── style.css
```

---

## 4. Journey So Far (What Was Done & Why)

### 4.1 Scaffold
- `npm init`, installed `three @types/three typescript vite three-stdlib`.
- `index.html` + `src/` layout created; GLB copied to `public/models/`.

### 4.2 Three.js architecture changes (key decisions)
- **First attempt**: own `requestAnimationFrame` loop + own renderer → replaced.
- **Current**: use 8th Wall's `XR8.Threejs.pipelineModule()` which owns scene/camera/renderer;
  we get them back via `XR8.Threejs.xrScene()` and add our model to *its* scene.
- The engine renders every frame internally — **we do not run our own render loop**.

### 4.3 Critical fixes discovered along the way

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | `window.THREE does not exist but is required by the ThreeJS pipeline module` | 8th Wall checks `window.THREE` global; ES-module import alone doesn't set it | `window.THREE = THREE;` at top of `ar-pipeline.ts` (before any `XR8` call) |
| 2 | `can't access property "getContext", l is undefined` | `XR8.run()` had no canvas | pass `canvas: document.getElementById('camerafeed')` |
| 3 | Modules logged as generic `Object` / silent stall | modules were passed inside `run({modules})` instead of registered | `XR8.addCameraPipelineModules(modules)` **before** `XR8.run()` |
| 4 | Stale `appKey` | old hosted-platform API | removed entirely |
| 5 | `onReady` never fires / promise never resolves | callbacks don't exist in new API | resolve `start()` from our module's `onStart`; treat `XR8.run` as fire-and-forget |
| 6 | Camera permission prompt missing | previously saved "Block" for `localhost:5500` | reset browser site permission / use incognito |
| 7 | Confusion: QR code on screen | **Vite dev-server QR overlay** (not 8th Wall mobile handoff) | harmless; optional `server.overlay.integrations: false` in vite config |
| 8 | Font CORS errors (`Nunito*.woff/ttf`) | XRExtras CDN lacks CORS headers | cosmetic only; CSS override to system-ui reduces attempts |

### 4.4 Camera verification (done)
- `public/camera-diagnostic.html` calls `getUserMedia({video:true})` directly.
- **Result: `SUCCESS! Camera stream obtained.` (track: "HD Webcam")** — browser, hardware, and
  permissions are all confirmed working. The camera is NOT the problem.

### 4.5 Current state (as of last session)
- 8th Wall engine loads in ~200ms; all modules register:
  `gltexturerenderer, reality, threejsrenderer, loading, almostthere, error, glasses-updater`
- `[App] AR session started successfully.` appears; glasses model logs "added to scene".
- **BUT the screen shows black (no camera feed visible)** — the Three.js scene renders but the
  camera background from `GlTextureRenderer` isn't compositing through.
- A **bright red debug cube** was added to the Three.js scene to test rendering.

---

## 5. Current Code Behavior (ar-pipeline.ts)

```ts
window.THREE = THREE;                       // required by Threejs.pipelineModule()

XR8.addCameraPipelineModules([
  XR8.GlTextureRenderer.pipelineModule(),   // draws camera feed
  XR8.XrController.pipelineModule(),        // tracking / pose
  XR8.Threejs.pipelineModule(),             // owns Three.js scene/camera/renderer
  XRExtras.Loading.pipelineModule(),
  XRExtras.AlmostThere.pipelineModule(),
  XRExtras.RuntimeError.pipelineModule(),
  { name: 'glasses-updater', onStart, onUpdate }  // our module
]);

XR8.run({ canvas: document.getElementById('camerafeed') });
```

`glasses-updater.onStart`:
- `const { scene, camera, renderer } = XR8.Threejs.xrScene()`
- `renderer.setClearColor(0x000000, 0)` (transparent clear, hoping camera shows through)
- adds debug red cube + loads `/models/glasses.glb` into scene

---

## 6. Open Problem (THE current blocker)

**Symptom:** AR session starts, logs are all green, but the visible output is black —
no webcam image, no cube visible yet (per last user report: only the Vite QR overlay page).

**Hypotheses (in order):**
1. `GlTextureRenderer` and `Threejs` module write to different WebGL framebuffers / the
   Three.js renderer's clear isn't actually transparent in the composited result.
2. The scene/renderer from `XR8.Threejs.xrScene()` isn't the one being drawn (module order).
3. Camera stream never actually starts inside 8th Wall (would show as black too).

**Active diagnostic:** the red debug cube. Outcomes:
- A) Black only → Three.js scene not rendering → problem getting/using `xrScene()`
- B) Red cube on black → Three.js OK, camera composition broken → fix background
- C) Webcam + red cube → both work → swap cube for glasses model, done
- D) Webcam only → scene not adding objects

---

## 6.5 DESKTOP TESTING FIX (Aug 1, 2026) — QR "Powered by 8th Wall" screen

**Symptom:** On laptop/desktop, no camera permission prompt appears — instead a full-screen
"Powered by 8th Wall" QR/almost-there screen shows, suggesting opening on a phone.

**Root cause (bug in our code):**
- `XR8.run()` requires `allowedDevices: XR8.XrConfig.device().ANY` to allow DESKTOP + mobile.
- `device` is a **function that must be called** (`device().ANY`).
- Old code: `allowedDevices: XR8.XrDevice?.ANY ?? XR8.XrConfig?.device?.ANY ?? 0`
  - `XR8.XrConfig.device?.ANY` accessed `.ANY` on the **function object** → `undefined`
  - Fell back to `0` (= mobile-only) → engine rejected desktop with:
    `"Desktop 3D Session Manager requires allowedDevices ANY"`
  - XRExtras AlmostThere then showed the "use your phone" QR screen.

**Fix (`src/ar-pipeline.ts`):**
```ts
const deviceAny = XR8.XrConfig?.device?.().ANY ?? XR8.XrDevice?.ANY ?? 0;
XR8.run({ canvas, allowedDevices: deviceAny });
```

Official docs (8thwall.org/docs/engine/overview): `allowedDevices: XR8.XrConfig.device().ANY`
is the documented invocation.

## 7. THE PLAN (next steps)

### Phase 1 — Get camera feed visible (current)
- [ ] Run the A/B/C/D cube test; identify which branch we're on.
- [ ] If B: stop relying on `GlTextureRenderer` composition; render camera as a
      Three.js `VideoTexture` on a full-screen plane behind the glasses
      (i.e., `getUserMedia` → `THREE.VideoTexture` → scene background). 8th Wall
      still provides tracking via `XrController`.
- [ ] If A: verify module order (GlTextureRenderer → XrController → Threejs) and
      that `xrScene()` is called in `onStart`, not before.
- [ ] Confirm camera feed + cube together.

### Phase 2 — Glasses model on face
- [ ] Remove debug cube.
- [ ] Position glasses at origin of face anchor; tune scale/rotation so it sits on the bridge.
- [ ] If face-landmark data is available in `onUpdate` frame, hook
      `face-metrics.ts` → `computeScaleFactors.ts` → `GlassesFitter.applyScaleFactors()`
      so the glasses auto-size to the user's face.

### Phase 3 — Polish
- [ ] Remove `camera-diagnostic.html` (or move to a `debug/` folder).
- [ ] Kill font-CORS noise if desired (already mitigated via CSS).
- [ ] Loading/error UX, "almost there" browser checks (XRExtras already does this).
- [ ] `npm run build` for production; deploy to HTTPS (required for camera outside localhost).

### Phase 4 — Extras (optional)
- [ ] Multiple frame styles (swap GLB), capture/photo button, mirror mode.
- [ ] Commercial check: SLAM license terms if world-tracking used alongside face effects.

---

## 8. Recurring Commands

```bash
cd /home/Rohil-Arch/Code_Repo/Glasses-tryon
npm run build                     # type-check + bundle (must exit 0)
npx vite --port 5500 --strictPort # dev server (keep running; hot reload)
# test pages
http://localhost:5500/               # main app (Try On)
http://localhost:5500/camera-diagnostic.html  # camera sanity check
```

---

## 9. Harmless Console Noise (do not chase)

- `Failed to get subsystem status for purpose` → browser extension (content-script.js), not our app.
- `Use of the orientation/motion sensor is deprecated` → 8th Wall internals, fine.
- `Source map error ... URL constructor:` → DevTools vs WASM, fine.
- `Cross-Origin Request Blocked ... Nunito*.woff/ttf` → XRExtras fonts, cosmetic.
- `[XR] Pause cannot be called at this time` → engine internal state, informational.

---

*Last updated: July 31, 2026 — AR session boots, camera proven working via diagnostic page,
blocker is camera-feed compositing in the Three.js scene (debug cube test in progress).*
