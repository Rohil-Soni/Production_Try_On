// src/ar-pipeline.ts
// 8th Wall AR pipeline for face tracking using Threejs pipeline module (official pattern)

import * as THREE from 'three';
import { GlassesFitter } from './GlassesFitter';

// 8th Wall's ThreeJS pipeline module requires THREE to be a global (window.THREE).
window.THREE = THREE;

const ENGINE_URL = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js';

declare global {
  interface Window {
    XR8: any;
    THREE: typeof THREE;
    XRExtras: any;
  }
}

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
    script.setAttribute('data-preload-chunks', 'slam,face');
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

  const api: ARPipeline = {
    scene,
    camera,
    renderer,
    onFaceUpdate: null,

    async start() {
      if (startedInternally) return Promise.resolve();
      startedInternally = true; // Mark as started immediately

      console.log('[ARPipeline] Loading 8th Wall engine...');

      const XR8 = await ensureXR8Loaded();
      console.log('[ARPipeline] Engine loaded.');

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
        modules.push(XR8.Threejs.pipelineModule());
        console.log('[ARPipeline] Added Threejs.pipelineModule');
      }

      // XRExtras modules (from the official example)
      const XRExtras = (window as any).XRExtras; // Access XRExtras from window
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
            scene = threejsResult.scene;
            camera = threejsResult.camera;
            renderer = threejsResult.renderer;

            // Make the three.js renderer's clear color fully transparent
            renderer!.setClearColor(0x000000, 0); // black, fully transparent
            api.renderer = renderer;

            console.log('[ARPipeline] Got Three.js scene, camera, and renderer');

      // Add a debug cube to verify Three.js rendering
      // const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      // const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Bright red
      // const cube = new THREE.Mesh(geometry, material);
      // if (scene) {
      //   scene.add(cube); // scene is definitely not null here
      // }
          } else {
            console.error('[ARPipeline] Failed to get Three.js scene, camera, or renderer');
            startedInternally = false; // Mark as failed to start
          }

          // Load the glasses model and add it to the scene
          (async () => {
            try {
              const glassesFitter = await GlassesFitter.fromURL('/models/glasses.glb');
              glassesScene = glassesFitter.getScene();
               if (glassesScene && scene) {
                 scene.add(glassesScene);
                 console.log('[ARPipeline] Glasses model added to scene');
               } else {
                 console.error('[ARPipeline] Failed to load or add glasses model');
               }
            } catch (err) {
              console.error('[ARPipeline] Failed to load glasses model:', err);
            }
          })();
        },
        onUpdate: (frame: any) => {
          const faceResult = frame?.processCpuResult?.facecontroller;
          if (!faceResult || !glassesScene) return;

          // attachmentPoints.attachment is the nose bridge — perfect anchor for glasses
          const attachment = faceResult.attachmentPoints?.attachment;
          if (!attachment) return;

          const { position, rotation, scale } = attachment;
          if (position) glassesScene.position.set(position.x, position.y, position.z);
          if (rotation) glassesScene.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
          if (scale)    glassesScene.scale.set(scale.x, scale.y, scale.z);
        },
      });

      console.log('[ARPipeline] Using pipeline modules:', modules.map(m => m.name || 'unnamed').join(', '));

      // Configure FaceController to provide attachment points for accurate face tracking
      if (XR8.FaceController?.configure) {
        XR8.FaceController.configure({
          meshGeometry: [
            XR8.FaceController.MeshGeometry.FACE,
            XR8.FaceController.MeshGeometry.EYES,
            XR8.FaceController.MeshGeometry.MOUTH,
          ],
          coordinates: { axes: 'RIGHT_HANDED', mirroredDisplay: true },
          maxDetections: 1,
        });
        console.log('[ARPipeline] Configured FaceController for attachment points');
      }

      // Register modules BEFORE calling run()
      XR8.addCameraPipelineModules(modules);

      // Run the engine (XR8.run does not take onReady/onError callbacks in current API)
      XR8.run({
        canvas: document.getElementById('camerafeed'),
        cameraConfig: { direction: XR8.XrConfig.camera().FRONT },
        allowedDevices: XR8.XrConfig.device().ANY,
      });

      return Promise.resolve(); // Resolves immediately; actual startup is async
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
    if (renderer) renderer.setSize(w, h);
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  });

  return api;
}