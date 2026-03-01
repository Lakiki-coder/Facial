/**
 * aiProcessing.js — AI Processing WebSocket Client
 *
 * Singleton client for communicating with the Spring Boot AI backend.
 * Handles WebSocket connection lifecycle, frame/audio sending,
 * REST API calls for model management, and event dispatching.
 */

class AIProcessingClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.serverUrl = '';
  }

  // ── Connection ──────────────────────────────────────────────────────────────

  connect(serverUrl) {
    this.serverUrl = serverUrl;

    return new Promise((resolve, reject) => {
      try {
        if (this.socket) this.socket.close();

        // Convert http(s) to ws(s) for WebSocket URL
        const wsUrl = serverUrl.replace(/^http/, 'ws');
        console.log('[AI] Connecting to ' + wsUrl + '/ws/ai-process');

        this.socket = new WebSocket(wsUrl + '/ws/ai-process');

        this.socket.onopen = () => {
          console.log('[AI] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', {});
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
          } catch (e) {
            console.error('[AI] Parse error:', e);
          }
        };

        this.socket.onerror = (error) => {
          console.error('[AI] WS error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.socket.onclose = (event) => {
          console.log('[AI] Closed:', event.code, event.reason);
          this.isConnected = false;
          this.emit('disconnected', { code: event.code, reason: event.reason });

          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(serverUrl), 2000 * this.reconnectAttempts);
          }
        };
      } catch (error) {
        console.error('[AI] Connection failed:', error);
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'Client disconnecting');
      this.socket = null;
      this.isConnected = false;
    }
  }

  // ── Message Handling ────────────────────────────────────────────────────────

  _handleMessage(message) {
    switch (message.type) {
      case 'connected':
        this.emit('connected', message);
        break;
      case 'processed_frame':
        this.emit('frameProcessed', message);
        break;
      case 'processed_audio':
        this.emit('audioProcessed', message);
        break;
      case 'config_status':
        this.emit('configStatus', message);
        break;
      case 'pong':
        this.emit('pong', message);
        break;
      case 'error':
        this.emit('error', message);
        break;
      default:
        console.log('[AI] Unknown message type:', message.type);
        break;
    }
  }

  // ── Send Methods ────────────────────────────────────────────────────────────

  sendFrame(frameData, timestamp) {
    if (!this.isConnected) return;
    if (!timestamp) timestamp = Date.now();
    this.socket.send(JSON.stringify({ type: 'frame', data: frameData, timestamp: timestamp }));
  }

  sendAudio(audioData, timestamp) {
    if (!this.isConnected) return;
    if (!timestamp) timestamp = Date.now();
    this.socket.send(JSON.stringify({ type: 'audio', data: audioData, timestamp: timestamp }));
  }

  configure(faceSwapEnabled, voiceConvertEnabled) {
    if (!this.isConnected) return;
    const msg = { type: 'config', faceSwap: faceSwapEnabled, voiceConvert: voiceConvertEnabled };
    this.socket.send(JSON.stringify(msg));
    console.log('[AI] Config sent:', msg);
  }

  ping() {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({ type: 'ping' }));
    }
  }

  // ── REST API Methods ────────────────────────────────────────────────────────

  async loadFace(imageData, faceName) {
    const res = await fetch(this.serverUrl + '/api/ai/face-swap/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: imageData, faceName: faceName }),
    });
    if (!res.ok) throw new Error('Failed to load face');
    return res.json();
  }

  async loadVoice(modelPath, voiceName) {
    const res = await fetch(this.serverUrl + '/api/ai/voice-convert/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelPath: modelPath, voiceName: voiceName }),
    });
    if (!res.ok) throw new Error('Failed to load voice');
    return res.json();
  }

  async setFaceSwapEnabled(enabled) {
    const res = await fetch(this.serverUrl + '/api/ai/face-swap/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled }),
    });
    return res.json();
  }

  async setVoiceConvertEnabled(enabled) {
    const res = await fetch(this.serverUrl + '/api/ai/voice-convert/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled }),
    });
    return res.json();
  }

  async getStatus() {
    const res = await fetch(this.serverUrl + '/api/ai/health');
    return res.json();
  }

  // ── Event System ────────────────────────────────────────────────────────────

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    const i = cbs.indexOf(callback);
    if (i > -1) cbs.splice(i, 1);
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    cbs.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[AI] Listener error (' + event + '):', e);
      }
    });
  }
}

export const aiClient = new AIProcessingClient();
export default aiClient;