// Lightweight waveform visualizer for mic input and TTS output.
export function createVisualizer(canvas, { colorA = '#6ee7ff', colorB = '#8b5cf6' } = {}) {
  const ctx = canvas.getContext('2d');
  const w = () => canvas.clientWidth;
  const h = () => canvas.clientHeight;

  // Draw waveform from float32 samples
  function drawWave(samples) {
    const width = w(), height = h();
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);

    // Gradient stroke
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;

    ctx.beginPath();
    const step = Math.max(1, Math.floor(samples.length / width));
    const mid = height / 2;
    for (let x = 0, i = 0; x < width; x++, i += step) {
      const s = samples[i] || 0;
      const y = mid + s * mid * 0.85;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return {
    update(float32Frame) {
      if (!float32Frame) return;
      drawWave(float32Frame);
    }
  };
}
