// src/main.ts
// Application entry point for the 8th Wall + Three.js glasses try-on

import './style.css';
import * as THREE from 'three';
import { createARPipeline } from './ar-pipeline.ts';
import { GlassesFitter } from './GlassesFitter';
import { computeFaceMeasurements } from './face-metrics';
import { computeScaleFactors } from './computeScaleFactors';

// Get the container for the Three.js renderer
const container = document.getElementById('renderer-container')!;
if (!container) {
  throw new Error('Renderer container not found. Ensure index.html has <div id="renderer-container"></div>');
}

// Create the AR pipeline (handles 8th Wall initialization and face tracking)
const pipeline = createARPipeline(container);

// Load the glasses model asynchronously
(async () => {
  const glassesFitter = await GlassesFitter.fromURL('/models/glasses.glb');
  const glassesScene = glassesFitter.getScene();
  pipeline.scene.add(glassesScene);

  // Define model dimensions (must match your GLB)
  // These are in millimeters
  const MODEL_DIMS = {
    frameWidth: 140,
    bridgeWidth: 18,
    lensWidth: 52,
    lensHeight: 40,
    templeLength: 145,
    nosePadGap: 12,
  };

  // Face tracking callback
  pipeline.onFaceUpdate = async (frame: any) => {
    const pose = frame?.worldTransform;
    const landmarks = frame?.faceData?.landmarks;

    if (!pose) {
      glassesScene.visible = false;
      return;
    }

    glassesScene.visible = true;

    // Compute face measurements from landmarks
    const measurements = landmarks ? computeFaceMeasurements(landmarks) : null;

    if (measurements) {
      // Compute scale factors from face measurements
      const factors = computeScaleFactors(measurements, MODEL_DIMS);
      glassesFitter.applyScaleFactors(factors);
    }

    // Apply face pose (position + rotation)
    const matrix = new THREE.Matrix4().fromArray(pose);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    matrix.decompose(position, quaternion, new THREE.Vector3());
    glassesScene.position.copy(position);
    glassesScene.quaternion.copy(quaternion);

    // Sync Three.js camera with 8th Wall's AR camera
    if (frame.cameraProjectionMatrix) {
      pipeline.camera.projectionMatrix.fromArray(frame.cameraProjectionMatrix);
    }
    if (frame.cameraViewMatrix) {
      pipeline.camera.matrixWorldInverse.fromArray(frame.cameraViewMatrix);
    }
  };
})();

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  pipeline.renderer.render(pipeline.scene, pipeline.camera);
}
animate();

// Start the AR session
pipeline.start();

// Optional: expose pipeline for debugging
(window as any).__pipeline = pipeline;
console.log('[App] AR pipeline started. Face the camera to see the glasses.');