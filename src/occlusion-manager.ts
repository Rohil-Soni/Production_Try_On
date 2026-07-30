// src/occlusion-manager.ts
// Manages dynamic occlusion of glasses temples based on head yaw

import * as THREE from 'three';

export class OcclusionManager {
  private rightParts: THREE.Object3D[] = [];
  private leftParts: THREE.Object3D[] = [];

  /**
   * Scan the glasses scene for left and right temple parts.
   * Assumes part names contain 'temple' and side indicators (_L/_R, .L/.R, left/right).
   */
  detectParts(root: THREE.Group) {
    this.rightParts = [];
    this.leftParts = [];
    root.traverse((child: any) => {
      if (!child.isMesh) return;
      const name = child.name.toLowerCase();
      const isTemple = /temple|stem|arm|side/.test(name);
      const isRight = /_r|\.r|right/.test(name);
      const isLeft = /_l|\.l|left/.test(name);
      if (isTemple && isRight) this.rightParts.push(child);
      if (isTemple && isLeft) this.leftParts.push(child);
    });
  }

  /**
   * Update opacity of left/right parts based on yaw angle (in degrees).
   * Yaw > 0: head turned right -> right temple is farther (should fade)
   * Yaw < 0: head turned left -> left temple is farther (should fade)
   * Fade starts at 10°, fully transparent at 28°.
   */
  update(yawDeg: number) {
    const fade = (v: number) => Math.max(0, Math.min(1, (Math.abs(v) - 10) / 18));
    const rightFade = yawDeg > 0 ? yawDeg : 0;
    const leftFade = yawDeg < 0 ? -yawDeg : 0;
    const rightOpacity = 1 - fade(rightFade) * 0.96;
    const leftOpacity = 1 - fade(leftFade) * 0.96;
    this._setOpacity(this.rightParts, rightOpacity);
    this._setOpacity(this.leftParts, leftOpacity);
  }

  private _setOpacity(parts: THREE.Object3D[], opacity: number) {
    for (const part of parts) {
      const mesh = part as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        mat.transparent = true;
        mat.opacity = opacity;
      }
    }
  }
}