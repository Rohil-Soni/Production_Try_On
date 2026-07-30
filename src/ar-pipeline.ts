// src/ar-pipeline.ts
// Initializes 8th Wall AR pipeline with face tracking

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