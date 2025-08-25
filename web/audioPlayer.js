// Plays base64 PCM16 24kHz mono with proper sample rate handling and clean barge-in resets.
export function createPlayer({ sampleRate = 24000, onFirstChunk, onFrame, onEnded }) {
  let audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
  let queue = [];
  let sourceNode = null;
  let gotFirst = false;
  let playing = false;

  function decodeBase64ToFloat32(base64) {
    // Single decode: base64 -> bytes -> Int16 -> Float32 [-1..1]
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      // Normalize signed 16-bit; 32768 = 0x8000
      float32[i] = Math.max(-1, Math.min(1, pcm16[i] / 32768));
    }
    return float32;
  }

  function playBuffer(float32) {
    if (!audioCtx) return;
    // Create buffer with correct sampleRate to avoid pitch/speed distortion
    const buf = audioCtx.createBuffer(1, float32.length, sampleRate);
    buf.copyToChannel(float32, 0, 0);

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.onended = () => {
      sourceNode = null;
      playing = false;
      if (queue.length > 0) {
        playNext();
      } else {
        onEnded && onEnded();
      }
    };

    if (!gotFirst) {
      gotFirst = true;
      onFirstChunk && onFirstChunk();
    }

    sourceNode = src;
    src.start(0);
  }

  function playNext() {
    if (playing) return;
    const next = queue.shift();
    if (!next) return;
    playing = true;
    const float32 = decodeBase64ToFloat32(next);
    onFrame && onFrame(float32);
    playBuffer(float32);
  }

  function resetAudioContext() {
    try { if (audioCtx) audioCtx.close(); } catch {}
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
  }

  return {
    enqueue(b64) {
      queue.push(b64);
      playNext();
    },
    cut() {
      // Barge-in: stop immediately and reset to prevent compounded artifacts
      try { if (sourceNode) sourceNode.stop(0); } catch {}
      queue = [];
      playing = false;
      gotFirst = false;
      resetAudioContext();
    },
    reset() {
      try { if (sourceNode) sourceNode.stop(0); } catch {}
      queue = [];
      playing = false;
      gotFirst = false;
      resetAudioContext();
      onEnded && onEnded();
    },
  };
}
