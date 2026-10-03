// src/ar-pipeline.ts
// 8th Wall AR pipeline for face tracking using Threejs pipeline module (official pattern)

import * as THREE from 'three';
import { GlassesFitter } from './GlassesFitter';

const ENGINE_URL = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js';

declare global {
  interface Window {
    XR8: any;
    THREE: typeof THREE;
    XRExtras: any;
  }
}

// 8th Wall's ThreeJS pipeline module requires THREE to be a global (window.THREE).
window.THREE = THREE;

let xr8ReadyPromise: Promise<any> | null = null;

function ensureXR8Loaded(): Promise<any> {
  if (xr8ReadyPromise) return xr8ReadyPromise;

  xr8ReadyPromise = new Promise((resolve, reject) => {
    if (window.XR8 !== undefined) {
      resolve(window.XR8);
      return;
    }

    const script = document.createElement('script');
    script.src = ENGINE_URL;
    script.async = true;
    script.setAttribute('data-preload-chunks', 'slam,face,threejs,extras');
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      const startTime = Date.now();
      const poll = () => {
        if (window.XR8 !== undefined) {
          console.log('[ARPipeline] XR8 engine ready in', Date.now() - startTime, 'ms');
          resolve(window.XR8);
          return;
        }
        if (Date.now() - startTime > 30000) {
          reject(new Error('8th Wall engine did not initialize within timeout'));
          return;
        }
        setTimeout(poll, 200);
      };
      try {
        poll();
      } catch (e) {
        reject(e);
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load 8th Wall engine binary from CDN'));
    };

    document.head.appendChild(script);
  });

  return xr8ReadyPromise;
}

export interface ARPipeline {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  onFaceUpdate: ((frame: any) => void) | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function createARPipeline(container: HTMLElement): ARPipeline {
  // Create a canvas for the AR view and append it to the container
  const canvas = document.createElement('canvas');
  canvas.id = 'camerafeed'; // must match the name expected by XR8 pipeline modules
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let glassesScene: THREE.Group | null = null;
  let renderer: THREE.WebGLRenderer | null = null;

  let startedInternally = false; // Internal flag for AR session state
  let hasLoggedFirstResult = false; // Flag to log first face result only once

  // Tuning constants – adjust to fit your glasses model on the face
  const tempOffset = new THREE.Vector3(0, 0.01, 0.02); // (x: left/right, y: up/down, z: forward/back) in meters
  const tempScale = new THREE.Vector3(0.9, 0.9, 0.9);   // uniform scale multiplier (1.0 = original size)

  const api: ARPipeline = {
    scene,
    camera,
    renderer,
    onFaceUpdate: null,

    // start the AR pipeline
    start: async () => {
      if (startedInternally) return;
      startedInternally = true;

      console.log('[ARPipeline] Loading 8th Wall engine...');
      const XR8 = await ensureXR8Loaded();
      console.log('[ARPipeline] Engine loaded.');

      // Configure FaceController BEFORE building pipeline modules
      if (XR8.FaceController?.configure) {
        XR8.FaceController.configure({
          meshGeometry: [
            XR8.FaceController.MeshGeometry.FACE,
            XR8.FaceController.MeshGeometry.EYES,
            XR8.FaceController.MeshGeometry.MOUTH,
          ],
          // Enable attachment points such as noseBridge, forehead, etc.
          attachmentPoints: true,
          coordinates: { axes: 'RIGHT_HANDED', mirroredDisplay: true },
          maxDetections: 1,
        });
        console.log('[ARPipeline] FaceController configured.');
      }

      // Build the modules array for XR8.run()
      const modules: any[] = [];

      // GlTextureRenderer module (renders camera feed to texture)
      if (XR8.GlTextureRenderer?.pipelineModule) {
        modules.push(XR8.GlTextureRenderer.pipelineModule());
        console.log('[ARPipeline] Added GlTextureRenderer.pipelineModule');
      }

      // FaceController module (provides face tracking) — mutually exclusive with XrController (SLAM/world tracking)
      if (XR8.FaceController?.pipelineModule) {
        modules.push(XR8.FaceController.pipelineModule());
        console.log('[ARPipeline] Added FaceController.pipelineModule');
      }

      // Threejs module (integrates with Three.js rendering)
      if (XR8.Threejs?.pipelineModule) {
        // Ensure THREE is set as global for the Threejs pipeline module
        window.THREE = THREE;
        modules.push(XR8.Threejs.pipelineModule());
        console.log('[ARPipeline] Added Threejs.pipelineModule');
      }

      // XRExtras modules (from the official example)
      const XRExtras = (window as any).XRExtras; // Access XRExtras from window
      if (XRExtras?.FullWindowCanvas?.pipelineModule) {
        modules.push(XRExtras.FullWindowCanvas.pipelineModule());
        console.log('[ARPipeline] Added XRExtras.FullWindowCanvas.pipelineModule');
      }

      if (XRExtras?.Loading?.pipelineModule) {
        modules.push(XRExtras.Loading.pipelineModule());
        console.log('[ARPipeline] Added XRExtras.Loading.pipelineModule');
      }

      if (XRExtras?.AlmostThere?.pipelineModule) {
        modules.push(XRExtras.AlmostThere.pipelineModule());
        console.log('[ARPipeline] Added XRExtras.AlmostThere.pipelineModule');
      }

      if (XRExtras?.RuntimeError?.pipelineModule) {
        modules.push(XRExtras.RuntimeError.pipelineModule());
        console.log('[ARPipeline] Added XRExtras.RuntimeError.pipelineModule');
      }

      // Our custom module for loading the glasses model and updating it based on face measurements
      modules.push({
        name: 'glasses-updater',
        onCameraStatusChange: ({ status, video, cameraConfig }: any) => {
          console.log('[Camera] status:', status, '| cameraConfig:', cameraConfig, '| video:', video ? 'stream present' : 'none');
        },
        onStart: () => {
          console.log('[ARPipeline] Custom module onStart — session is ready');

          const threejsResult = XR8.Threejs.xrScene();
          if (threejsResult && threejsResult.scene && threejsResult.camera && threejsResult.renderer) {
            // Keep non-null local references for use in this callback (TS narrowing is lost on
            // captured `let` variables, e.g. `scene` below).
            const activeScene = threejsResult.scene;
            const activeCamera = threejsResult.camera;
            const activeRenderer = threejsResult.renderer;

            scene = activeScene;
            camera = activeCamera;
            renderer = activeRenderer;

             api.scene = scene;
             api.camera = camera;
            api.renderer = renderer;

            console.log('[ARPipeline] Got Three.js scene, camera, and renderer');

            // DEBUG: green sphere at (0,0,-0.5) — if visible, Three.js compositing works
            const debugSphere = new THREE.Mesh(
              new THREE.SphereGeometry(0.05, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            debugSphere.position.set(0, 0, -0.5);
            activeScene.add(debugSphere);
            console.log('[ARPipeline] Debug sphere added.');

            // Load the glasses model and add it to the scene
            (async () => {
              try {
                const glassesFitter = await GlassesFitter.fromURL('/models/glasses1.glb');
                glassesScene = glassesFitter.getScene();
                if (glassesScene && activeScene) {
                  // Apply temporary offset/scale for quick tuning (adjust as needed)
                  glassesScene.position.add(tempOffset);
                  glassesScene.scale.multiply(tempScale);
                  activeScene.add(glassesScene);
                  console.log('[ARPipeline] Glasses model added to scene');
                } else {
                  console.error('[ARPipeline] Failed to load or add glasses model');
                }
              } catch (err) {
                console.error('[ARPipeline] Failed to load glasses model:', err);
              }
            })();
          } else {
            console.error('[ARPipeline] Failed to get Three.js scene, camera, or renderer');
            startedInternally = false; // Mark as failed to start
          }
        },
        onUpdate: (frame: any) => {
          const faceResult = frame?.processCpuResult?.facecontroller;
          if (!faceResult) return;

          // TEMP DEBUG: confirm the theory — log the full faceResult once.
          // If it only has cameraFeedTexture, intrinsics, position {0,0,0},
          // rotation {0,0,0,w:-1} and nothing else — the detector is running
          // but finding no face.
          if (!hasLoggedFirstResult) {
            console.log('[Face] full faceResult:', JSON.stringify(faceResult));
            hasLoggedFirstResult = true;
          }

          if (!glassesScene) return;

          // attachmentPoints.noseBridge is the nose bridge — perfect anchor for glasses
          const attachment = faceResult.attachmentPoints?.noseBridge;
          if (!attachment) return;

          // Apply face transform (position + rotation)
          if (attachment.position) {
            // Convert face rotation to THREE.Quaternion
            const faceQuat = new THREE.Quaternion(
              faceResult.rotation.x,
              faceResult.rotation.y,
              faceResult.rotation.z,
              faceResult.rotation.w
            );
            // Offset in face local space
            const offset = new THREE.Vector3(
              attachment.position.x,
              attachment.position.y,
              attachment.position.z
            );
            // Rotate offset into world space
            offset.applyQuaternion(faceQuat);
            // World position = face position + rotated offset
            glassesScene.position.set(
              faceResult.position.x + offset.x,
              faceResult.position.y + offset.y,
              faceResult.position.z + offset.z
            );
          }

          if (faceResult.rotation) {
            glassesScene.quaternion.set(
              faceResult.rotation.x,
              faceResult.rotation.y,
              faceResult.rotation.z,
              faceResult.rotation.w
            );
          }

          // Apply scale tuning (attachment.scale may not be provided; fallback to tempScale)
          if (attachment.scale) {
            glassesScene.scale.copy(attachment.scale).multiply(tempScale);
          } else {
            // If attachment scale not provided, just use the tuning scale
            glassesScene.scale.copy(tempScale);
          }

          // Throttled diagnostic: confirm tracking data is live and changing.
          // Remove once the glasses track correctly.
          if (frame.timestamp % 60 === 0) {
            const p = glassesScene.position;
            console.log('[Face] live pos:', p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3));
          }
        },
      });

      console.log('[ARPipeline] Using pipeline modules:', modules.map(m => m.name || 'unnamed').join(', '));

      // Register modules BEFORE calling run()
      XR8.addCameraPipelineModules(modules);

      // Disable world tracking (SLAM) — required for desktop front-camera use.
      // FaceController is mutually exclusive with XrController (SLAM/world tracking).
      if (XR8.XrController?.configure) {
        XR8.XrController.configure({ disableWorldTracking: true });
        console.log('[ARPipeline] XrController configured (world tracking disabled).');
      }

      // Run the engine (XR8.run does not take onReady/onError callbacks in current API)
      // Use XrDevice.ANY for allowed devices (desktop + mobile)
      XR8.run({
        canvas: document.getElementById('camerafeed'),
        cameraConfig: {
          direction: XR8.XrConfig.camera().FRONT,
          width: 640,
          height: 480,
        },
        allowedDevices: XR8.XrConfig.device().ANY,
      });

      // The actual start signal comes from the custom module's onStart.
      // We return immediately; the caller can treat the start as fire-and-forget.
      return;
    },

    stop() {
      if (!startedInternally) return;
      if (window.XR8?.stop) window.XR8.stop();
      startedInternally = false;
    },
  };

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    // Update the renderer size
    if (renderer) renderer.setSize(w, h);
    // Update the camera aspect ratio if camera is available
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  });

  return api;
}