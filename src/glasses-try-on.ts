// src/glasses-try-on.ts
// Main glasses try-on controller integrating MediaPipe + Three.js

import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import type { LandmarkPoint } from './mediaPipeFaceMesh';
import { MediaPipeFaceMesh } from './mediaPipeFaceMesh';

export interface GlassesTryOnOptions {
  videoElement: HTMLVideoElement;
  container: HTMLElement;
  modelUrl: string;
  onReady?: () => void;
  onError?: (err: Error) => void;
}

export class GlassesTryOn {
  private videoElement: HTMLVideoElement;
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private glassesModel: THREE.Group | null = null;
  private modelUrl: string;
  private mediaPipe: MediaPipeFaceMesh | null = null;
  private animationId: number | null = null;
  private options: GlassesTryOnOptions;

  constructor(options: GlassesTryOnOptions) {
    this.videoElement = options.videoElement;
    this.container = options.container;
    this.modelUrl = options.modelUrl;
    this.options = options;

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.getAspect(), 0.01, 100);
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(this.getWidth(), this.getHeight());
    this.renderer.setClearColor(0x000000, 0);

    // Append renderer to container
    this.container.appendChild(this.renderer.domElement);

    // Set up camera closer to objects
    this.camera.position.z = 2;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(0, 5, 5);
    this.scene.add(directionalLight);

    // Add fill light for better visibility
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 0, 5);
    this.scene.add(fillLight);

    // Initialize MediaPipe
    this.mediaPipe = new MediaPipeFaceMesh(this.videoElement, {
      filterUrl: this.modelUrl,
      onLandmarksDetected: this.onLandmarksDetected.bind(this),
      onReady: options.onReady,
      onError: options.onError
    });

    // Load glasses model
    this.loadGlassesModel();
  }

  private getAspect(): number {
    const width = this.getWidth();
    const height = this.getHeight();
    return width / height;
  }

  private getWidth(): number {
    return this.videoElement.videoWidth || 640;
  }

  private getHeight(): number {
    return this.videoElement.videoHeight || 480;
  }

  private async loadGlassesModel(): Promise<void> {
    try {
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          this.modelUrl,
          (gltf) => resolve(gltf),
          undefined,
          (error) => reject(error)
        );
      });

      this.glassesModel = gltf.scene;
      if (this.glassesModel) {
        this.scene.add(this.glassesModel);

        // Center and scale the model
        const box = new THREE.Box3().setFromObject(this.glassesModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 0.5 / maxDim;

        this.glassesModel.position.sub(center);
        this.glassesModel.scale.multiplyScalar(scale);

        console.log('[GlassesTryOn] Model loaded and centered');
      }
    } catch (error) {
      console.error('[GlassesTryOn] Failed to load model:', error);
      this.options.onError?.(error as Error);
    }
  }

  private onLandmarksDetected(landmarks: LandmarkPoint[]): void {
    if (!this.glassesModel || landmarks.length < 264) return;

    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    if (!noseTip || !leftEye || !rightEye) return;

    const width = this.getWidth();
    const height = this.getHeight();

    // MediaPipe coordinates: x,y in [0,1] (top-left origin)
    // We need to convert to Three.js world coordinates:
    // - x: -1 to 1 (left to right)
    // - y: -1 to 1 (bottom to top)
    // - z: -1 to 1 (front to back)
    // - Mirror x for webcam

    // Convert to pixel coordinates first
    const leftEyePixelX = leftEye.x * width;
    const leftEyePixelY = leftEye.y * height;
    const rightEyePixelX = rightEye.x * width;
    const rightEyePixelY = rightEye.y * height;
    const nosePixelX = noseTip.x * width;
    const nosePixelY = noseTip.y * height;

    // Mirror x for front-facing camera
    const mirroredLeftEyeX = width - leftEyePixelX;
    const mirroredRightEyeX = width - rightEyePixelX;
    const mirroredNoseX = width - nosePixelX;

    // Convert to normalized device coordinates (-1 to 1)
    const ndcLeftEyeX = (mirroredLeftEyeX / width) * 2 - 1;
    const ndcLeftEyeY = 1 - (leftEyePixelY / height) * 2; // Flip Y
    const ndcRightEyeX = (mirroredRightEyeX / width) * 2 - 1;
    const ndcRightEyeY = 1 - (rightEyePixelY / height) * 2;
    const ndcNoseX = (mirroredNoseX / width) * 2 - 1;
    const ndcNoseY = 1 - (nosePixelY / height) * 2;

    // Scale to world coordinates
    const scale = 2.0;
    const worldLeftEye = new THREE.Vector3(ndcLeftEyeX * scale, ndcLeftEyeY * scale, 0);
    const worldRightEye = new THREE.Vector3(ndcRightEyeX * scale, ndcRightEyeY * scale, 0);
    const worldNose = new THREE.Vector3(ndcNoseX * scale, ndcNoseY * scale, 0.1);

    console.log('[GlassesTryOn] World coords:');
    console.log('  Left eye:', worldLeftEye);
    console.log('  Right eye:', worldRightEye);
    console.log('  Nose:', worldNose);

    // Calculate eye center and direction
    const eyeCenter = new THREE.Vector3().addVectors(worldLeftEye, worldRightEye).multiplyScalar(0.5);
    const eyeDirection = new THREE.Vector3().subVectors(worldRightEye, worldLeftEye).normalize();
    const eyeDistance = worldLeftEye.distanceTo(worldRightEye);

    // Position glasses (slightly above eyes)
    const glassesPosition = eyeCenter.clone();
    glassesPosition.y += eyeDistance * 0.1;
    glassesPosition.z += 0.02;

    // Calculate rotation from eye direction
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      eyeDirection
    );

    console.log('[GlassesTryOn] Position:', glassesPosition);
    console.log('[GlassesTryOn] Rotation:', targetQuaternion);

    // Apply transform
    this.glassesModel.position.copy(glassesPosition);
    this.glassesModel.quaternion.copy(targetQuaternion);
  }

  public start(): void {
    this.mediaPipe?.start();
    this.animate();
    console.log('[GlassesTryOn] Started');
  }

  public stop(): void {
    this.mediaPipe?.stop();
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    console.log('[GlassesTryOn] Stopped');
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  };

  public destroy(): void {
    this.stop();
    this.mediaPipe?.destroy();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}