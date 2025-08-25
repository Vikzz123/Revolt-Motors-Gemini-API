import { createPlayer } from './audioPlayer.js';
import { createRecorder } from './recorder.js';
import { createVisualizer } from './visualizer.js';
import { connectWS } from './websocket.js';

const latencyEl = document.getElementById('latency');
const captionEl = document.getElementById('caption');
const micBtn = document.getElementById('mic');
const stopBtn = document.getElementById('stop');
const vizCanvas = document.getElementById('viz');

let ws, recorder, player, turnStartAt;
let micViz, ttsViz;
let isHolding = false;

async function startSession() {
  // Backend now auto-detects language & default voice; no dropdowns needed
  const resp = await fetch('/api/live/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  if (!resp.ok) throw new Error('Failed to start session');
  const { wsUrl } = await resp.json();

  recorder = await createRecorder((base64Pcm16k, float32Frame) => {
    if (!turnStartAt) turnStartAt = performance.now();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'audio', data: base64Pcm16k }));
    }
    micViz && micViz.update(float32Frame);
  });

  player = createPlayer({
    sampleRate: 24000,
    onFirstChunk: () => {
      if (turnStartAt) {
        const ms = Math.max(0, Math.round(performance.now() - turnStartAt));
        latencyEl.textContent = `${ms} ms`;
      }
      showCaption(''); // clear; caption will fill from ASR parts
    },
    onFrame: (float32) => {
      ttsViz && ttsViz.update(float32);
    },
    onEnded: () => {
      hideCaption();
    },
  });

  ws = await connectWS(wsUrl, {
    onOpen: () => {},
    onAudio: (base64) => {
      player.enqueue(base64);
    },
    onASR: (parts) => {
      // Show short, rolling caption while model speaks
      const text = parts.map(p => p.text || '').join(' ').trim();
      if (text) showCaption(text);
    },
    onTurnComplete: () => {
      turnStartAt = null;
      hideCaption();
    },
    onError: (e) => {
      showCaption(`Error: ${e}`);
    },
    onServerClose: () => {
      stopSession();
    },
  });

  micViz = createVisualizer(vizCanvas, { colorA: '#6ee7ff', colorB: '#8b5cf6' });
  ttsViz = micViz; // reuse same canvas; we just render whichever stream is active

  // Start streaming immediately on hold
}

function showCaption(text) {
  captionEl.textContent = text || '';
  captionEl.classList.remove('hidden');
}
function hideCaption() {
  captionEl.classList.add('hidden');
  captionEl.textContent = '';
}

async function holdToTalkStart() {
  if (isHolding) return;
  isHolding = true;
  if (!ws) {
    try { await startSession(); } catch (e) { showCaption(e.message || String(e)); return; }
  }
  try { recorder && recorder.start(); } catch {}
}

function holdToTalkEnd() {
  if (!isHolding) return;
  isHolding = false;
  // Stop sending mic but keep session open to hear model
  try { recorder && recorder.pause(); } catch {}
}

function hardStop() {
  // Barge-in stop if model is speaking
  if (ws && ws.readyState === WebSocket.OPEN) {
    player.cut();
    ws.send(JSON.stringify({ type: 'interrupt' }));
  }
}

function stopSession() {
  try { recorder && recorder.stop(); } catch {}
  try { player && player.reset(); } catch {}
  try { ws && ws.close(); } catch {}
  ws = null;
  latencyEl.textContent = '-- ms';
  hideCaption();
}

// Press-and-hold to talk
micBtn.addEventListener('mousedown', holdToTalkStart);
micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); holdToTalkStart(); });
['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
  micBtn.addEventListener(evt, holdToTalkEnd);
});

// Long-press or quick tap to barge-in stop
micBtn.addEventListener('dblclick', (e) => {
  e.preventDefault();
  hardStop();
});

stopBtn.addEventListener('click', stopSession);

// Initialize visualizer
createVisualizer(vizCanvas, { colorA: '#6ee7ff', colorB: '#8b5cf6' });
