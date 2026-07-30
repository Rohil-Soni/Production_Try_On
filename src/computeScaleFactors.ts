import type { FaceMeasurements, ModelDimensions, ScaleFactors } from './GlassesScaleFactors';

const CLEARANCE_MM = 16;

export function computeScaleFactors(face: FaceMeasurements, model: ModelDimensions): ScaleFactors {
  const Sx = (face.faceWidth - CLEARANCE_MM) / model.frameWidth;
  const Sy = Sx;
  const Sz = face.faceWidth / model.frameWidth;

  const scaledHalfFrame = (model.frameWidth * Sx) / 2;
  const earHalf = face.earToEar / 2;
  const targetTemple = Math.max(earHalf - scaledHalfFrame, model.templeLength * 0.3);

  return {
    frame:  { x: Sx, y: Sy, z: Sz },
    bridge: { x: face.noseBridgeWidth / model.bridgeWidth, y: Sy, z: Sz },
    temple: { x: targetTemple / model.templeLength, y: Sy, z: Sz },
    nosePad:{ x: Sx, y: face.noseBridgeHeight / model.nosePadGap, z: Sz },
  };
}

export function validateScaleFactors(f: ScaleFactors): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [name, v] of Object.entries(f)) {
    if (v.x < 0.1 || v.x > 3.0) errors.push(`${name}.x=${v.x.toFixed(2)} out of bounds`);
    if (v.y < 0.1 || v.y > 3.0) errors.push(`${name}.y=${v.y.toFixed(2)} out of bounds`);
    if (v.z < 0.1 || v.z > 3.0) errors.push(`${name}.z=${v.z.toFixed(2)} out of bounds`);
  }
  return { valid: errors.length === 0, errors };
}