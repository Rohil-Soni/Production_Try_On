// src/main.ts
import './style.css';
import { MediaPipeFaceMesh } from './mediaPipeFaceMesh';
import { GlassesTryOn } from './glasses-try-on';
import { DebugOverlay } from './debug-overlay';

const videoElement = document.getElementById('video') as HTMLVideoElement;
const overlayContainer = document.getElementById('overlay-container') as HTMLElement;
const toggleButton = document.getElementById('toggle-camera') as HTMLButtonElement;

if (!videoElement || !overlayContainer) {
  throw new Error('Required elements not found in DOM');
}

// Make these available globally for the toggle button
let glassesTryOn: GlassesTryOn | null = null;
let mediaPipe: MediaPipeFaceMesh | null = null;
let debugOverlay: DebugOverlay | null = null;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing...');

  // Create debug overlay
  debugOverlay = new DebugOverlay(overlayContainer);

  // Set up video size watcher
  videoElement.addEventListener('loadedmetadata', () => {
    if (debugOverlay) {
      debugOverlay.setVideoSize(videoElement.videoWidth || 640, videoElement.videoHeight || 480);
    }
  });

  // Instantiate MediaPipe Face Mesh
  mediaPipe = new MediaPipeFaceMesh(videoElement, {
    filterUrl: '/models/glasses1.glb',
    onReady: () => {
      console.log('MediaPipe Face Mesh ready');
      // Start glasses try-on once MediaPipe is ready
      glassesTryOn = new GlassesTryOn({
        videoElement: videoElement,
        container: overlayContainer,
        modelUrl: '/models/glasses1.glb',
        onReady: () => {
          console.log('Glasses Try-On ready');
          glassesTryOn?.start();
        },
        onError: (err) => {
          console.error('Error initializing Glasses Try-On:', err);
        }
      });
    },
    onError: (err) => {
      console.error('Error initializing MediaPipe Face Mesh:', err);
    },
    onLandmarksDetected: (landmarks) => {
      console.log('[main] Landmarks detected:', landmarks.length);
      // Update debug overlay
      if (debugOverlay) {
        debugOverlay.drawLandmarks(landmarks);
      }
    }
  });

  // Toggle camera button
  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      if (glassesTryOn && mediaPipe) {
        if (mediaPipe.isRunning()) {
          glassesTryOn.stop();
          toggleButton.textContent = 'Start Camera';
        } else {
          glassesTryOn.start();
          toggleButton.textContent = 'Stop Camera';
        }
      }
    });
  }
});