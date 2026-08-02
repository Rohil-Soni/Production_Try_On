// src/glasses-renderer.ts
// Manages the glasses model: loading, scaling, posing, and materials

import * as THREE from 'three';
import { GlassesFitter } from './GlassesFitter';
import { computeScaleFactors, validateScaleFactors } from './computeScaleFactors';
import type { FaceMeasurements, ModelDimensions } from './GlassesScaleFactors';

export class GlassesRenderer {
  root = new THREE.Group();
  private fitter: GlassesFitter | null = null;
  private modelDims: ModelDimensions | null = null;
  private offset = new THREE.Vector3();
  private scaleFactor = 1;

  async loadModel(url: string, modelDims: ModelDimensions) {
    this.modelDims = modelDims;
    this.fitter = await GlassesFitter.fromURL(url);
    this.root.add(this.fitter.getScene());
    this.applyDefaultMaterials();
  }

  private applyDefaultMaterials() {
    this.root.traverse((child: any) => {
      if (!child.isMesh) return;
      const name = child.name.toLowerCase();
      const isLens = name.includes('lens') || name.includes('glass');
      const isFrame = name.includes('frame') || name.includes('front') || name.includes('rim');
      const isTemple = name.includes('temple') || name.includes('arm') || name.includes('stem');
      const isBridge = name.includes('nose') || name.includes('bridge') || name.includes('pad');

      let material: THREE.Material;
      if (isLens) {
        material = new THREE.MeshStandardMaterial({
          color: 0x88ccff,
          metalness: 0.0,
          roughness: 0.2,
          transparent: true,
          opacity: 0.15,
          envMapIntensity: 0.5,
        });
      } else if (isFrame) {
        material = new THREE.MeshStandardMaterial({
          color: 0x1a1a1a,
          metalness: 0.3,
          roughness: 0.5,
          envMapIntensity: 0.8,
        });
      } else if (isTemple) {
        material = new THREE.MeshStandardMaterial({
          color: 0x1a1a1a,
          metalness: 0.2,
          roughness: 0.6,
          envMapIntensity: 0.7,
        });
      } else if (isBridge) {
        material = new THREE.MeshStandardMaterial({
          color: 0x1a1a1a,
          metalness: 0.25,
          roughness: 0.5,
          envMapIntensity: 0.75,
        });
      } else {
        // Keep original material if we can't classify
        return;
      }

      // Replace material
      child.material = material;
    });
  }

  updateFromFace(measurements: FaceMeasurements, pose: THREE.Matrix4) {
    if (!this.fitter || !this.modelDims) return;

    const factors = computeScaleFactors(measurements, this.modelDims);
    const validation = validateScaleFactors(factors);
    if (!validation.valid) return;

    this.fitter.applyScaleFactors(factors);

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    pose.decompose(pos, quat, new THREE.Vector3());
    this.root.position.copy(pos).add(this.offset);
    this.root.quaternion.copy(quat);
    this.root.scale.set(this.scaleFactor, this.scaleFactor, this.scaleFactor);
  }

  setOffset(x: number, y: number, z: number) { this.offset.set(x, y, z); }
  setScale(s: number) { this.scaleFactor = s; }
}