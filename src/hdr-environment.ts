// src/hdr-environment.ts
// Sets up an HDR environment map for realistic reflections

import * as THREE from 'three';

export function setupEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();

  // Create a simple gradient environment (sky-like)
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x87ceeb); // sky blue
  // Add a gradient ground? For simplicity, we'll just use a solid color.
  // In a real app, you might load an HDR equirectangular map.
  const envMap = pmremGenerator.fromScene(envScene, 0, 0.1, 100).texture;
  scene.environment = envMap;
  pmremGenerator.dispose();
}