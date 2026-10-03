// src/mediaPipeFaceMesh.ts
// MediaPipe Face Mesh integration for glasses try-on

import * as THREE from 'three';
import * as mp from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface ARFilterOptions {
  filterUrl: string;
  maxNumFaces?: number;
  minDetectionConfidence?: number;
  onReady?: () => void;
  onError?: (err: Error) => void;
  onLandmarksDetected?: (landmarks: LandmarkPoint[]) => void;
}

export class MediaPipeFaceMesh {
  private faceMesh: mp.FaceMesh | null = null;
  private camera: Camera | null = null;
  private videoElement: HTMLVideoElement;
  private options: ARFilterOptions;
  private _isRunning = false;

  constructor(videoElement: HTMLVideoElement, options: ARFilterOptions) {
    this.videoElement = videoElement;
    this.options = options;
    this.initFaceMesh();
  }

  private async initFaceMesh(): Promise<void> {
    try {
      console.log('[MediaPipeFaceMesh] Loading MediaPipe Face Mesh...');

      // Use the static import which is already bundled
      this.faceMesh = new mp.FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        }
      });

      this.faceMesh.setOptions({
        maxNumFaces: this.options.maxNumFaces || 1,
        refineLandmarks: true,
        minDetectionConfidence: this.options.minDetectionConfidence || 0.5,
        minTrackingConfidence: 0.5
      });

      this.faceMesh.onResults((results: any) => {
        console.log('[MediaPipe] Results received:', results ? 'yes' : 'no');

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0];
          const landmarkPoints: LandmarkPoint[] = landmarks.map((lm: any) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility
          }));

          console.log('[MediaPipe] ✅ Detected', landmarkPoints.length, 'landmarks');
          console.log('[MediaPipe] Sample landmarks:');
          console.log('  Nose tip (1):', landmarkPoints[1]);
          console.log('  Left eye (33):', landmarkPoints[33]);
          console.log('  Right eye (263):', landmarkPoints[263]);

          this.options.onLandmarksDetected?.(landmarkPoints);
        } else {
          console.log('[MediaPipe] ⚠️ No face detected in frame');
        }
      });

      // Initialize the FaceMesh before starting
      await this.faceMesh.initialize();
      console.log('[MediaPipeFaceMesh] ✅ FaceMesh initialized successfully');
      this.options.onReady?.();
    } catch (error) {
      console.error('[MediaPipeFaceMesh] ❌ Failed to initialize:', error);
      this.options.onError?.(error as Error);
    }
  }

  public start(): void {
    if (this._isRunning) return;

    console.log('[MediaPipeFaceMesh] Starting camera...');

    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        if (!this.faceMesh) {
          console.log('[MediaPipeFaceMesh] ⚠️ FaceMesh not ready, skipping frame');
          return;
        }

        try {
          await this.faceMesh.send({ image: this.videoElement });
        } catch (error) {
          console.error('[MediaPipeFaceMesh] Error sending frame:', error);
        }
      },
      width: 640,
      height: 480,
    });

    this.camera.start()
      .then(() => {
        this._isRunning = true;
        console.log('[MediaPipeFaceMesh] ✅ Camera started successfully');
      })
      .catch((error) => {
        console.error('[MediaPipeFaceMesh] ❌ Failed to start camera:', error);
        this.options.onError?.(error as Error);
      });
  }

  public stop(): void {
    if (!this._isRunning || !this.camera) return;

    this.camera.stop();
    this._isRunning = false;
    console.log('[MediaPipeFaceMesh] Camera stopped');
  }

  public isRunning(): boolean {
    return this._isRunning;
  }

  public destroy(): void {
    this.stop();
    this.faceMesh = null;
    this.camera = null;
  }
}

// Utility functions for landmark conversion
export class LandmarkUtils {
  /**
   * Convert normalized landmarks to pixel coordinates
   */
  static normToPixel(landmarks: LandmarkPoint[], width: number, height: number): { x: number; y: number }[] {
    return landmarks.map(lm => ({
      x: lm.x * width,
      y: lm.y * height
    }));
  }

  /**
   * Get key anchor points for glasses placement
   */
  static getGlassesAnchors(landmarks: LandmarkPoint[]): {
    leftEye: LandmarkPoint;
    rightEye: LandmarkPoint;
    noseBridge: LandmarkPoint;
  } | null {
    if (landmarks.length < 264) {
      console.warn('[LandmarkUtils] Not enough landmarks:', landmarks.length);
      return null;
    }

    return {
      leftEye: landmarks[33],      // Left eye outer corner
      rightEye: landmarks[263],    // Right eye outer corner
      noseBridge: landmarks[1]     // Nose tip (closest to bridge)
    };
  }

  /**
   * Calculate transformation matrix for glasses placement
   */
  static calculateGlassesTransform(
    anchors: { leftEye: LandmarkPoint; rightEye: LandmarkPoint; noseBridge: LandmarkPoint },
    imageWidth: number,
    imageHeight: number
  ): THREE.Matrix4 {
    const { leftEye, rightEye } = anchors;

    // Convert to pixel coordinates
    const leftEyePixel = new THREE.Vector3(leftEye.x * imageWidth, leftEye.y * imageHeight, leftEye.z);
    const rightEyePixel = new THREE.Vector3(rightEye.x * imageWidth, rightEye.y * imageHeight, rightEye.z);

    console.log('[LandmarkUtils] Eye positions:');
    console.log('  Left eye pixel:', leftEyePixel);
    console.log('  Right eye pixel:', rightEyePixel);

    // Calculate scale from eye distance
    const eyeDistance = leftEyePixel.distanceTo(rightEyePixel);
    const canonicalEyeDistance = 0.3; // Meters in world space
    const scale = eyeDistance / (canonicalEyeDistance * imageWidth);

    console.log('[LandmarkUtils] Scale:', scale);

    // Calculate rotation from eye line
    const eyeDirection = new THREE.Vector3().subVectors(rightEyePixel, leftEyePixel).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      eyeDirection
    );

    // Calculate position (center between eyes, slightly above)
    const center = new THREE.Vector3().addVectors(leftEyePixel, rightEyePixel).multiplyScalar(0.5);
    center.y -= eyeDistance * 0.1; // Slightly above eyes

    console.log('[LandmarkUtils] Center position:', center);

    // Create transformation matrix
    const matrix = new THREE.Matrix4();
    matrix.compose(center, rotation, new THREE.Vector3(scale, scale, scale));

    return matrix;
  }
}