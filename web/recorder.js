// Streams base64 PCM16 mono 16kHz frames; also passes Float32 for visualization.
export async function createRecorder(onData) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000
    }
  });

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx({ sampleRate: 16000 });
  const source = audioCtx.createMediaStreamSource(stream);

  // Smaller frame → lower latency, more overhead
  const frameSize = 2048;  // ~128ms at 16kHz
  const processor = audioCtx.createScriptProcessor(frameSize, 1, 1);  // deprecated but still widely supported
  source.connect(processor);   // mic → processor
  processor.connect(audioCtx.destination);   // processor → (speakers or nowhere)

  // PCM16 16kHz mono → base64
  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);

    const pcm16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const bytes = new Uint8Array(pcm16.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);

    onData(base64, input);
  };

  return {
    start() { /* connected → flowing */ },
    pause() { /* optional no-op; keep flowing and let onData gate if needed */ },
    stop() {
      try { processor.disconnect(); } catch {}
      try { source.disconnect(); } catch {}
      try { audioCtx.close(); } catch {}
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
    }
  };
}