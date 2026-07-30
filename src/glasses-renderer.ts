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