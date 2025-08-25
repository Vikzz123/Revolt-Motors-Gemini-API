// Establish and manage WebSocket connection with given handlers
export async function connectWS(path, handlers) {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;
  const ws = new WebSocket(url);
  ws.onopen = () => handlers.onOpen && handlers.onOpen(); // Connection opened
  // Handle incoming messages
  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    switch (msg.type) {
      case 'server-open': // Server acknowledged connection
        handlers.onServerOpen && handlers.onServerOpen();
        break;
      case 'audio': // Audio data (base64-encoded)
        handlers.onAudio && handlers.onAudio(msg.data);
        break;
      case 'asr': // ASR-like partial text feedback
        handlers.onASR && handlers.onASR(msg.parts);
        break;
      case 'turn-complete':  // Turn complete
        handlers.onTurnComplete && handlers.onTurnComplete();
        break;
      case 'server-close':  // Server closed connection
        handlers.onServerClose && handlers.onServerClose();
        break;
      case 'error':  // Error message
        handlers.onError && handlers.onError(msg.error);
        break;
      default:
        break;
    }
  };
  // Handle connection errors
  ws.onclose = () => handlers.onServerClose && handlers.onServerClose();
  return ws;
}
