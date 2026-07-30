import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import type { ScaleFactors, GlassesPartNames } from './GlassesScaleFactors';

export class GlassesFitter {
  private scene: THREE.Group;
  private parts = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Group) { this.scene = scene; this.indexParts(); }

  static async fromURL(url: string): Promise<GlassesFitter> {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new GlassesFitter(gltf.scene);
  }

  private indexParts() {
    this.parts.clear();
    this.scene.traverse(obj => { if (obj.name) this.parts.set(obj.name, obj); });
  }

  applyScaleFactors(factors: ScaleFactors, names: GlassesPartNames = {}) {
    const n = {
      frame: names.frame ?? 'Frame',
      bridge: names.bridge ?? 'Bridge',
      templeLeft: names.templeLeft ?? 'Temple_L',
      templeRight: names.templeRight ?? 'Temple_R',
      nosePadLeft: names.nosePadLeft ?? 'NosePad_L',
      nosePadRight: names.nosePadRight ?? 'NosePad_R',
    };

    this._scaleOne(n.frame,         factors.frame);
    this._scaleOne(n.bridge,        factors.bridge);
    this._scaleOne(n.templeLeft,    factors.temple);
    this._scaleOne(n.templeRight,   factors.temple);
    this._scaleOne(n.nosePadLeft,   factors.nosePad);
    this._scaleOne(n.nosePadRight,  factors.nosePad);
  }

  private _scaleOne(name: string, scale: { x: number; y: number; z: number }) {
    const obj = this.parts.get(name);
    if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box.getCenter(c);
    obj.position.sub(c);
    obj.scale.multiply(new THREE.Vector3(scale.x, scale.y, scale.z));
    obj.position.add(c);
    obj.position.multiply(new THREE.Vector3(scale.x, scale.y, scale.z));
  }

  getScene() { return this.scene; }
  listParts() { return Array.from(this.parts.keys()).sort(); }
  hasPart(name: string) { return this.parts.has(name); }
  getPart(name: string) { return this.parts.get(name); }
}