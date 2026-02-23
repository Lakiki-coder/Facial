/**
 * AI Processing Utility
 * Handles WebSocket communication with the AI backend for face swap and voice conversion
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

  /**
   * Connect to AI processing WebSocket server
   * @param {string} serverUrl - The AI backend WebSocket URL
   */
  connect(serverUrl) {
    this.serverUrl = serverUrl;
    
    return new Promise((resolve, reject) => {
      try {
        // Close existing connection if any
        if (this.socket) {
          this.socket.close();
        }

        console.log(`[AI] Connecting to ${serverUrl}/ws/ai-process`);
        
        this.socket = new WebSocket(`${serverUrl}/ws/ai-process`);

        this.socket.onopen = () => {
          console.log('[AI] ✅ Connected to AI Processing server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', {});
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('[AI] Error parsing message:', e);
          }
        };

        this.socket.onerror = (error) => {
          console.error('[AI] ❌ WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.socket.onclose = (event) => {
          console.log('[AI] 🔌 Connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Attempt reconnection if not intentionally closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[AI] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            setTimeout(() => this.connect(serverUrl), 2000 * this.reconnectAttempts);
          }
        };

      } catch (error) {
        console.error('[AI] Failed to connect:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    console.log('[AI] Received:', message.type);
    
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
    }
  }

  /**
   * Send a video frame for AI processing
   * @param {string} frameData - Base64 encoded frame data
   * @param {number} timestamp - Frame timestamp
   */
  sendFrame(frameData, timestamp = Date.now()) {
    if (!this.isConnected || !this.socket) {
      console.warn('[AI] Not connected, cannot send frame');
      return;
    }

    const message = {
      type: 'frame',
      data: frameData,
      timestamp: timestamp
    };

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Send audio data for AI processing
   * @param {string} audioData - Base64 encoded audio data
   * @param {number} timestamp - Audio timestamp
   */
  sendAudio(audioData, timestamp = Date.now()) {
    if (!this.isConnected || !this.socket) {
      console.warn('[AI] Not connected, cannot send audio');
      return;
    }

    const message = {
      type: 'audio',
      data: audioData,
      timestamp: timestamp
    };

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Configure AI processing settings
   * @param {boolean} faceSwapEnabled - Enable/disable face swap
   * @param {boolean} voiceConvertEnabled - Enable/disable voice conversion
   */
  configure(faceSwapEnabled, voiceConvertEnabled) {
    if (!this.isConnected || !this.socket) {
      console.warn('[AI] Not connected, cannot configure');
      return;
    }

    const message = {
      type: 'config',
      faceSwap: faceSwapEnabled,
      voiceConvert: voiceConvertEnabled
    };

    this.socket.send(JSON.stringify(message));
    console.log('[AI] Sent config:', message);
  }

  /**
   * Send ping to keep connection alive
   */
  ping() {
    if (!this.isConnected || !this.socket) return;

    this.socket.send(JSON.stringify({ type: 'ping' }));
  }

  /**
   * Load a face for face swapping
   * @param {string} imageData - Base64 encoded face image
   * @param {string} faceName - Name for the face
   */
  async loadFace(imageData, faceName) {
    const response = await fetch(`${this.serverUrl}/api/ai/face-swap/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, faceName })
    });
    
    if (!response.ok) {
      throw new Error('Failed to load face');
    }
    
    return response.json();
  }

  /**
   * Load a voice model for voice conversion
   * @param {string} modelPath - Path to the voice model
   * @param {string} voiceName - Name for the voice
   */
  async loadVoice(modelPath, voiceName) {
    const response = await fetch(`${this.serverUrl}/api/ai/voice-convert/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelPath, voiceName })
    });
    
    if (!response.ok) {
      throw new Error('Failed to load voice');
    }
    
    return response.json();
  }

  /**
   * Enable or disable face swap
   */
  async setFaceSwapEnabled(enabled) {
    const response = await fetch(`${this.serverUrl}/api/ai/face-swap/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    
    return response.json();
  }

  /**
   * Enable or disable voice conversion
   */
  async setVoiceConvertEnabled(enabled) {
    const response = await fetch(`${this.serverUrl}/api/ai/voice-convert/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    
    return response.json();
  }

  /**
   * Get AI service status
   */
  async getStatus() {
    const response = await fetch(`${this.serverUrl}/api/ai/health`);
    return response.json();
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`[AI] Error in ${event} listener:`, e);
      }
    });
  }

  /**
   * Disconnect from AI server
   */
  disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'Client disconnecting');
      this.socket = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const aiClient = new AIProcessingClient();
export default aiClient;
