// src/main.ts
import './style.css';
import { createARPipeline } from './ar-pipeline.ts';

const container = document.getElementById('renderer-container')!;
if (!container) {
  throw new Error('Renderer container not found.');
}

const pipeline = createARPipeline(container);

// Tap-to-start overlay (required for camera permission)
const overlay = document.createElement('div');
overlay.id = 'start-overlay';
overlay.innerHTML = `<div style="
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.85); z-index: 9999; color: white;
    font-family: -apple-system, sans-serif; cursor: pointer;
  ">
    <div style="font-size: 48px; margin-bottom: 16px;">👓</div>
    <div style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Try On</div>
    <div style="font-size: 14px; opacity: 0.7;">Allow camera access when prompted</div>
  </div>`;
document.body.appendChild(overlay);

let started = false;

overlay.addEventListener('click', async () => {
  if (started) return;
  started = true;
  overlay.style.display = 'none';

  try {
    await pipeline.start();
    console.log('[App] AR session started successfully.');
  } catch (err) {
    console.error('[App] Failed to start AR session:', err);
    overlay.innerHTML = `<div style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.85); z-index: 9999; color: white;
        font-family: -apple-system, sans-serif; cursor: pointer;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 18px; margin-bottom: 8px;">Camera unavailable</div>
        <div style="font-size: 14px; opacity: 0.7;">Tap to retry</div>
      </div>`;
    overlay.style.display = 'flex';
    started = false;

    overlay.addEventListener('click', async () => {
      if (started) return;
      started = true;
      overlay.style.display = 'none';
      try {
        await pipeline.start();
      } catch {
        started = false;
        overlay.style.display = 'flex';
      }
    }, { once: true });
  }
});

(window as any).__pipeline = pipeline;
console.log('[App] Ready. Tap the screen to start AR.');