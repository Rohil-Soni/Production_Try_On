# Glasses Try‑On AR Filter – Implementation Roadmap

*Version: 2026‑09‑22*  
*Target audience: developers working on the **Glasses‑tryon** project*  
*Scope: from a minimal prototype (Python‑style demo) to a production‑ready web/mobile product with Three.js, MediaPipe JS, UI, performance optimisations and CI/CD.*

---

## 📋 Overview
The goal is to deliver a **real‑time glasses‑try‑on** experience that can be embedded in a web page or mobile web view.  
We will progress through **four major phases**:
1. **Prototype** – Quick proof‑of‑concept using the existing Python demo.
2. **Web SDK Integration** – Port to JavaScript/TypeScript, integrate MediaPipe JS and Three.js, and expose a clean API.
3. **Feature‑Complete Product** – Add UI controls, asset management, device‑specific tweaks, and automated tests.
4. **Production‑Ready Release** – Optimise performance, implement CI/CD, documentation, analytics, and packaging for CDN distribution.

Each phase lists **pre‑requisites**, **deliverables**, **detailed tasks**, and **acceptance criteria**.

---

## Phase 1 – Prototype (≈ 2 weeks)
### Pre‑requisites
- Working Python environment with OpenCV & MediaPipe (already in `requirements.txt`).
- Access to the **learnopencv** demo folder (`Create-AR-filters-using-Mediapipe`).
- Familiarity with the existing codebase (review `apply_filter.py`).

### Deliverables
- A **stand‑alone prototype** that captures webcam video, runs MediaPipe Face Mesh, and overlays a static glasses PNG.
- Simple CLI to switch between filter assets.
- Recorded demo video (`outputs/demo.mp4`).

### Detailed Tasks
1. **Clone & verify demo** – Run `python apply_filter.py` to ensure the baseline works on the dev machine.
2. **Refactor into a reusable module** – Extract the pipeline into `prototype/face_mesh_demo.py` exposing a `run()` function.
3. **Add config for filter assets** – Load any PNG from `filters/` via a command‑line argument.
4. **Improve robustness** – Handle camera open failures, add graceful shutdown on `Ctrl‑C`.
5. **Create quick‑start documentation** – `README.md` in `prototype/` with install/run steps.
6. **Record a short demo** – 30 s video showing the glasses tracking across head movements.

### Acceptance Criteria
- Running `python prototype/face_mesh_demo.py --filter glasses.png` opens a webcam window with the glasses tracking fluidly (≥ 15 fps).
- The demo works on macOS, Linux, and Windows (tested locally).
- Documentation allows a new developer to get the demo running in < 10 minutes.

---

## Phase 2 – Web SDK Integration (≈ 4 weeks)
### Pre‑requisites
- Completion of Phase 1.
- Node ≥ 18, npm/yarn, and the existing TypeScript project (`src/` directory).  
- Familiarity with **MediaPipe JS** (`@mediapipe/face_mesh`) and **Three.js** (already used for other AR features in the repo).
- Decision on bundler (Vite is already configured – see `vite.config.ts`).

### Deliverables
- A **TypeScript library** (`src/mediaPipeFaceMesh.ts`) exposing:
  ```ts
  interface ARFilterOptions {
    filterUrl: string; // PNG/GLTF asset
    onReady?: () => void;
    onError?: (err: Error) => void;
  }
  export class GlassesTryOn {
    constructor(videoElement: HTMLVideoElement, options: ARFilterOptions);
    start(): Promise<void>;
    stop(): void;
  }
  ```
- A **demo page** (`public/demo.html`) that loads the SDK, starts the webcam, and renders the glasses with Three.js.
- Unit tests for the conversion utilities (landmark → pixel, pixel → 3‑D pose).

### Detailed Tasks
| # | Task | Sub‑tasks & Rationale |
|---|------|-----------------------|
| 2.1 | **Add MediaPipe JS dependency** | `npm i @mediapipe/face_mesh @mediapipe/camera_utils`. Verify Vite imports work (ESM). |
| 2.2 | **Create wrapper class** (`src/mediaPipeFaceMesh.ts`) | • Initialise `FaceMesh` with appropriate options (maxNumFaces = 1, refineLandmarks = true).  
• Use `Camera` helper to feed video frames.  
• In `onResults`, convert normalized landmarks to pixel coordinates (`x * videoWidth`, `y * videoHeight`). |
| 2.3 | **Map landmarks to glasses pose** | • Choose three anchor points: left eye outer corner (landmark 33), right eye outer corner (landmark 263), nose bridge (landmark 6).  
• Compute a **similarity transform** (scale, rotation, translation) that maps a canonical glasses model coordinate system to the detected anchors.  
• Convert the 2‑D transform into a **Three.js Object3D matrix** (use `makeBasis` or `setFromMatrix4`). |
| 2.4 | **Load glasses asset** | • Support static PNG overlay (Canvas 2‑D) *and* GLTF/GLB 3‑D model.  
• For GLTF, use `GLTFLoader` and attach the model to a `Group` whose matrix is updated each frame. |
| 2.5 | **Render pipeline** | • Set up a Three.js scene with a transparent background, a single `PerspectiveCamera` matching the video aspect, and a `WebGLRenderer` that draws onto an overlay canvas.  
• Each `onResults` call: update the glasses object's matrix, then `renderer.render(scene, camera)`. |
| 2.6 | **Create demo page** | • Minimal HTML: `<video id="video" autoplay muted playsinline></video>` and `<canvas id="overlay"></canvas>`.  
• Instantiate `GlassesTryOn` with the video element and a GLTF URL. |
| 2.7 | **Write conversion utilities** (`src/utils/landmark.ts`) | • `normToPixel(landmark, width, height)` → `{x, y}`.  
• `landmarksToPose(landmarks)` → `THREE.Matrix4`. |
| 2.8 | **Add unit tests** (`test/landmark.test.ts`) | • Test that normalized → pixel conversion is accurate for known inputs.  
• Verify the pose matrix aligns the three anchor points within a tolerance (e.g., < 2 px). |
| 2.9 | **Performance profiling** | • Use Chrome DevTools to measure frame‑time.  
• Target ≤ 30 ms per frame on a mid‑range laptop.  
• If needed, down‑sample the video feed (e.g., 640×480) and enable `FaceMesh`’s `maxNumFaces = 1`. |
| 2.10 | **Documentation** | • Update `README.md` with usage example, API reference, and a link to the demo page. |

### Acceptance Criteria
- `npm run dev` starts the Vite dev server; navigating to `/demo.html` shows a live webcam with glasses tracking.
- The TypeScript library builds with `npm run build` (no type errors). 
- Unit tests pass (`npm test`).
- Frame‑time stays below 30 ms on a typical laptop (tested on a 2022 MacBook Air and an Ubuntu VM). 
- The API is documented in `docs/API.md`.

---

## Phase 3 – Feature‑Complete Product (≈ 5 weeks)
### Pre‑requisites
- Phase 2 completed and merged into `main`.
- Design mock‑ups for the UI (filter selector, capture button, share options).  
- Access to a CDN or static‑file host for serving GLTF assets.

### Deliverables
- **Full UI** with filter gallery, a “try‑on” toggle, and a “snapshot” button.
- **Asset pipeline** – ability to add new glasses GLTFs without code changes (JSON manifest).
- **Cross‑device support** – mobile browsers (iOS Safari, Android Chrome) and desktop.
- **Automated integration tests** (Cypress or Playwright) for key user flows.
- **Analytics stub** (track `start`, `stop`, `snapshot` events).

### Detailed Tasks
| # | Task | Details |
|---|------|---------|
| 3.1 | **UI framework** | Use existing UI library in the repo (e.g., React or plain vanilla). Create components: `FilterSelector`, `CaptureButton`, `TryOnCanvas`. |
| 3.2 | **Filter manifest** | Add `public/filters/manifest.json` listing each GLTF/PNG with `id`, `name`, `thumbnailUrl`. Load manifest at runtime to populate the selector. |
| 3.3 | **Dynamic asset loading** | When a user selects a filter, call `glassesTryOn.setFilter(url)` which disposes the previous GLTF and loads the new one via `GLTFLoader`. |
| 3.4 | **Snapshot feature** | Capture the rendered overlay canvas + video frame into a single PNG using `canvas.toBlob`. Offer download or share via Web Share API. |
| 3.5 | **Mobile optimisation** | • Ensure `touch` events trigger start/stop.  
• Reduce video resolution for low‑end devices (e.g., 480 p).  
• Test with `aspectRatio` handling on portrait orientation. |
| 3.6 | **Accessibility** | Add `aria-label`s, keyboard focus handling, and a high‑contrast UI theme. |
| 3.7 | **Automated E2E tests** | Write Playwright tests that:  
1. Load the page.  
2. Grant camera permission (mocked).  
3. Switch filters and verify the overlay canvas updates (pixel diff).  
4. Click snapshot and ensure a download is triggered. |
| 3.8 | **Analytics stub** | Use a tiny wrapper (`src/analytics.ts`) that sends events to a configurable endpoint (default no‑op). |
| 3.9 | **Error handling UX** | Show friendly messages when camera access is denied or MediaPipe fails to initialise. |
| 3.10 | **Documentation & demo** | Update the repo’s `README.md` with a “Getting Started” section for the web demo, and add a hosted demo link (e.g., GitHub Pages). |

### Acceptance Criteria
- Users can select any filter from the gallery and see the glasses follow their face in real‑time.
- The “snapshot” button produces a downloadable PNG that visually matches the live view.
- All UI works on Chrome (Desktop & Android) and Safari (iOS). No console errors.
- Playwright test suite runs headless (`npm run test:e2e`) and passes.
- A basic analytics endpoint receives the expected events (can be a mock server).

---

## Phase 4 – Production‑Ready Release (≈ 3 weeks)
### Pre‑requisites
- Phase 3 merged and validated in a release branch.
- CI/CD pipeline set up (GitHub Actions).  
- CDN bucket ready for static assets (e.g., Cloudflare R2 or AWS S3).  
- Legal/branding assets approved.

### Deliverables
- **Optimised bundle** (≤ 300 KB gzipped) with tree‑shaking, code‑splitting, and lazy‑load of heavy GLTF files.
- **Performance budget report** (Lighthouse scores > 90 for FCP & TTI).
- **Versioned releases** (semantic versioning) and changelog.
- **Comprehensive docs** (API, integration guide, FAQ).  
- **Monitoring** – health check endpoint and error logging (e.g., Sentry integration).  
- **Release notes** and a **public demo URL**.

### Detailed Tasks
| # | Task | Details |
|---|------|---------|
| 4.1 | **Bundle optimisation** | Use Vite’s `build.rollupOptions` to split MediaPipe and Three.js into separate chunks. Enable `esbuild` minification, and generate source maps for debugging. |
| 4.2 | **Asset CDN upload** | Write a GitHub Action that, on tag creation, uploads `public/filters/*.glb` and the JS bundle to the CDN bucket, then invalidates the cache. |
| 4.3 | **Lighthouse audit** | Run `npm run lighthouse` against the hosted demo. Fix any performance regressions (e.g., lazy‑load the MediaPipe script, use `requestVideoFrameCallback` for smoother updates). |
| 4.4 | **Error monitoring** | Integrate Sentry (`@sentry/browser`). Initialise with environment‑specific DSN. Capture unhandled promise rejections and MediaPipe errors. |
| 4.5 | **Semantic release** | Configure `semantic-release` to auto‑bump version based on conventional commit messages. Generate a `CHANGELOG.md`. |
| 4.6 | **Documentation site** | Use Docusaurus or VitePress to host `docs/`. Include API reference (auto‑generated from TypeDoc), integration guide, and troubleshooting. |
| 4.7 | **Legal & branding** | Add a `LICENSE` (MIT) and a `CONTRIBUTING.md`. Verify all third‑party assets (glasses models, MediaPipe) are correctly attributed. |
| 4.8 | **Final QA** | Deploy a staging environment (`staging.example.com`). Run cross‑browser manual QA checklist (camera permissions, orientation changes, low‑light conditions). |
| 4.9 | **Production rollout** | Tag `v1.0.0`, trigger CI to publish the bundle and assets, and announce the release (GitHub release notes). |

### Acceptance Criteria
- The production build loads in < 1 s on a 3G connection (Lighthouse Performance > 90).  
- Asset URLs point to the CDN and have cache‑control headers (`max‑age=31536000`).
- Sentry receives no uncaught errors in the first week of usage.  
- Release notes accurately list all new features and breaking changes.
- Documentation site is live and searchable.

---

## 📅 Timeline Summary
| Phase | Duration | Key Milestones |
|-------|----------|----------------|
| 1 – Prototype | 2 weeks | Working Python demo, video demo, docs |
| 2 – Web SDK | 4 weeks | TypeScript library, demo page, unit tests |
| 3 – Feature‑Complete | 5 weeks | UI, filter gallery, snapshot, mobile support, E2E tests |
| 4 – Production | 3 weeks | Optimised bundle, CI/CD, monitoring, public release |

**Total estimated effort:** ~ 14 weeks (≈ 3.5 months) for a small team (1 frontend dev, 1 backend/ops). Adjustments can be made based on resource availability.

---

## 📂 Repository Changes
- **Delete any old plan files** (currently none, but the script will remove anything matching `*plan*.md`).
- **Add** `AR_TRYON_PLAN.md` (this file).
- Subsequent phases will add files under `src/`, `public/`, `test/`, and `docs/` as described.

---

*That’s the full roadmap. Let me know if you’d like any section refined, or if we should start creating the first set of source files.*
