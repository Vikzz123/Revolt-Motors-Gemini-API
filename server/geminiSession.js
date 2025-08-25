import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer } from 'ws';
dotenv.config();

// Use the official GenAI SDK for Live API
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessions = new Map();
let wss;

// Attach WebSocket upgrade handling to the HTTP server
export function attachUpgrade(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      // Expect URL like /api/live/ws/:sessionId
      const match = request.url && request.url.match(/\/api\/live\/ws\/([a-zA-Z0-9-]+)$/);
      if (!match) {
        socket.destroy();
        return;
      }
      const sessionId = match[1];
      if (!sessions.has(sessionId)) {
        socket.destroy();
        return;
      }
      // Handle the WebSocket upgrade
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, sessionId);
      });
    } catch {
      socket.destroy();
    }
  });
  
  // On new WebSocket connection
  wss.on('connection', (browserWs, _req, sessionId) => {
    const session = sessions.get(sessionId);
    if (!session) {
      try { browserWs.close(); } catch {}
      return;
    }
    setupGeminiBridge(session, browserWs);
  });
}

// Create a new Gemini session with given language and voice
export async function createGeminiSession({ language, voice }) {
  const id = uuidv4();  // Generate a unique session ID
  const sysPath = path.join(__dirname, 'systemInstruction.txt'); // default system instruction file
  let systemInstruction = process.env.SYSTEM_INSTRUCTION || ''; // from env var
  // If not in env, try reading from file
  if (!systemInstruction && fs.existsSync(sysPath)) {
    systemInstruction = fs.readFileSync(sysPath, 'utf-8');
  }
  const s = {
    id,
    language: language || 'en-IN', // Default to English (India)
    voice: voice || 'Puck',  // Default voice
    systemInstruction, // may be empty
  };
  sessions.set(id, s);
  setTimeout(() => sessions.delete(id), 30 * 60 * 1000); // Auto-expire after 30 minutes
  return s;
}

async function setupGeminiBridge(session, browserWs) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    safeSend(browserWs, { type: 'error', error: 'Missing GEMINI_API_KEY' });
    browserWs.close();
    return;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-native-audio-dialog';
  const ai = new GoogleGenAI({ apiKey });

  // Live session config using @google/genai
  const config = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: session.systemInstruction || defaultSystemInstruction,
    audioConfig: {
      inputFormat: 'audio/pcm;rate=16000',
      outputSampleRateHz: 24000,
      voice: session.voice,
      languageCode: session.language,
    },
    // Optional extras:
    // outputAudioTranscription: { enable: true }, // if you want model's own output transcript
    enableVoiceActivityEvents: true,
  };

  let live;
  try {
    live = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => {
          safeSend(browserWs, { type: 'server-open' });
        },
        onmessage: (message) => {
          // message may contain audio bytes and/or serverContent
          // Audio: message.data (base64 PCM16 24kHz)
          if (message?.data) {
            safeSend(browserWs, { type: 'audio', data: message.data });
          }
          // Text parts / ASR-like feedback:
          const parts = message?.serverContent?.modelTurn?.parts;
          if (parts && Array.isArray(parts) && parts.length > 0) {
            safeSend(browserWs, { type: 'asr', parts });
          }
          // Turn complete
          if (message?.serverContent?.turnComplete) {
            safeSend(browserWs, { type: 'turn-complete' });
          }
        },
        onerror: (e) => {
          safeSend(browserWs, { type: 'error', error: e?.message || String(e) });
        },
        onclose: () => {
          safeSend(browserWs, { type: 'server-close' });
          try { browserWs.close(); } catch {}
        },
      },
    });
  } catch (e) {
    safeSend(browserWs, { type: 'error', error: `Connect error: ${e?.message || e}` });
    try { browserWs.close(); } catch {}
    return;
  }

  // Browser -> model
  browserWs.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      switch (msg.type) {
        case 'audio': {
          // Send streamed audio up
          live.sendRealtimeInput({
            audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
          });
          break;
        }
        case 'text': {
          live.sendRealtimeInput({ text: msg.text || '' });
          break;
        }
        case 'interrupt': {
          // Barge-in: stop current speech
          live.sendClientEvent({ event: 'barge-in' });
          break;
        }
        case 'flush': {
          live.flush && live.flush();
          break;
        }
        default:
          break;
      }
    } catch {
      // ignore malformed
    }
  });

  browserWs.on('close', () => {
    try { live.close(); } catch {}
  });
}

// Safely send a JSON message over WebSocket if open
function safeSend(ws, obj) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  } catch {}
}

// A default system instruction if none provided via env or file
const defaultSystemInstruction = `
Role: Rev, Revolt Motors AI assistant.
- Only discuss Revolt Motors: RV400 variants, specs, pricing guidance, financing, booking, test rides, app features, charging, service, warranty, dealerships, delivery, and support.
- Decline unrelated topics and steer back to Revolt Motors.
- Be concise, friendly, and professional.
- If uncertain, avoid fabrications; suggest official resources or support.
- Prefer answers under ~3 sentences unless details are necessary.
`;
