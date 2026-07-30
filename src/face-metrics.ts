import type { FaceMeasurements } from './GlassesScaleFactors';

/**
 * Convert 8th Wall's 468 face landmarks (array of [x,y,z]) into FaceMeasurements.
 * Landmark indices follow MediaPipe convention.
 */
export function computeFaceMeasurements(landmarks: number[][]): FaceMeasurements | null {
  if (!landmarks || landmarks.length < 455) return null;

  const dist = (a: number, b: number) => {
    const dx = landmarks[a][0] - landmarks[b][0];
    const dy = landmarks[a][1] - landmarks[b][1];
    const dz = landmarks[a][2] - landmarks[b][2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  // Key landmark indices (same as MediaPipe)
  // 234 = left temple, 454 = right temple
  // 33 = left eye outer, 263 = right eye outer
  // 130 = left eye inner, 359 = right eye inner
  // 10 = forehead, 152 = chin
  // 168 = nose bridge (anchor), 6 = nose tip

  const faceWidth = dist(234, 454);
  const eyeDist = dist(33, 263);
  const noseBridgeWidth = dist(130, 359);
  // const faceHeight = dist(10, 152); // unused for now

  // Approximate ear-to-ear from face width (empirical factor)
  const earToEar = faceWidth * 1.15;

  return {
    faceWidth,
    pupillaryDist: eyeDist,
    noseBridgeWidth: noseBridgeWidth,
    earToEar,
    noseBridgeHeight: dist(168, 6), // nose bridge to tip
  };
}