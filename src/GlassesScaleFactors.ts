/** All face measurements in millimeters */
export interface FaceMeasurements {
  faceWidth: number;
  pupillaryDist: number;
  noseBridgeWidth: number;
  earToEar: number;
  noseBridgeHeight: number;
}

/** Reference dimensions of the 3D glasses model (measure in Blender) */
export interface ModelDimensions {
  frameWidth: number;
  bridgeWidth: number;
  lensWidth: number;
  lensHeight: number;
  templeLength: number;
  nosePadGap: number;
}

export interface ScaleVector { x: number; y: number; z: number; }

export interface ScaleFactors {
  frame: ScaleVector;
  bridge: ScaleVector;
  temple: ScaleVector;
  nosePad: ScaleVector;
}

export interface GlassesPartNames {
  frame?: string;
  bridge?: string;
  templeLeft?: string;
  templeRight?: string;
  nosePadLeft?: string;
  nosePadRight?: string;
  glassesRoot?: string;
}