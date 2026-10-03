// src/debug-overlay.ts
// Debug overlay for visualizing landmarks and glasses

export class DebugOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoWidth = 640;
  private videoHeight = 480;

  constructor(container: HTMLElement) {
    // Create canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.videoWidth;
    this.canvas.height = this.videoHeight;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '10';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    container.appendChild(this.canvas);
  }

  public drawLandmarks(landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.videoWidth, this.videoHeight);

    if (landmarks.length < 264) return;

    // Draw all landmarks as green dots
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const x = lm.x * this.videoWidth;
      const y = lm.y * this.videoHeight;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1, 0, 2 * Math.PI);
      this.ctx.fillStyle = '#00ff00';
      this.ctx.fill();
    }

    // Highlight key points
    const keyPoints = [
      { idx: 1, color: '#ff0000', label: 'nose' },
      { idx: 33, color: '#0000ff', label: 'left' },
      { idx: 263, color: '#0000ff', label: 'right' }
    ];

    for (const kp of keyPoints) {
      if (kp.idx < landmarks.length) {
        const lm = landmarks[kp.idx];
        const x = lm.x * this.videoWidth;
        const y = lm.y * this.videoHeight;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = kp.color;
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(kp.label, x + 8, y - 8);
      }
    }

    // Draw line between eyes
    if (landmarks[33] && landmarks[263]) {
      const le = landmarks[33];
      const re = landmarks[263];
      this.ctx.beginPath();
      this.ctx.moveTo(le.x * this.videoWidth, le.y * this.videoHeight);
      this.ctx.lineTo(re.x * this.videoWidth, re.y * this.videoHeight);
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Update stats
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`Faces: 1 | Landmarks: ${landmarks.length}`, 10, 20);
  }

  public setVideoSize(width: number, height: number): void {
    this.videoWidth = width;
    this.videoHeight = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
