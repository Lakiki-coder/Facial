/**
 * aiProcessing.js - AI Processing Client (Commented Version)
 * 
 * This utility module handles WebSocket communication with the AI backend server
 * for real-time face swap and voice conversion processing.
 * 
 * It provides methods to:
 * - Connect/disconnect from AI server
 * - Send video frames for processing
 * - Send audio for voice conversion
 * - Configure AI settings
 * - Load face and voice models
 * 
 * Uses an event-driven pattern for handling server responses.
 */

/**
 * AIProcessingClient Class
 * 
 * A client class for communicating with the AI processing server.
 * Manages WebSocket connection, message handling, and reconnection logic.
 * 
 * This is exported as a singleton (single instance) for use throughout the app.
 */
class AIProcessingClient {
  /**
   * Constructor
   * 
   * Initializes the client with default values.
   * No connection is established until connect() is called.
   */
  constructor() {
    this.socket = null;                    // WebSocket connection
    this.isConnected = false;              // Connection status
    this.listeners = new Map();           // Event listeners storage
    this.reconnectAttempts = 0;           // Current reconnection attempt count
    this.maxReconnectAttempts = 5;        // Maximum reconnection attempts
    this.serverUrl = '';                  // Current server URL
  * Connect to AI Server }

  /**
  
   * 
   * Establishes a WebSocket connection to the AI processing server.
   * 
   * @param {string} serverUrl - The base URL of the AI server (e.g., 'http://localhost:8080')
   * @returns {Promise} - Resolves when connected, rejects on error
   * 
   * Connection process:
   * 1. Closes existing connection if any
   * 2. Creates new WebSocket connection
   * 3. Sets up event handlers (open, message, error, close)
   * 4. Returns a promise that resolves when connected
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
        
        // Create WebSocket connection to the AI processing endpoint
        this.socket = new WebSocket(`${serverUrl}/ws/ai-process`);

        /**
         * Connection Opened Handler
         * 
         * Called when WebSocket connection is successfully established.
         */
        this.socket.onopen = () => {
          console.log('[AI] ✅ Connected to AI Processing server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', {});  // Notify listeners
          resolve();
        };

        /**
         * Message Received Handler
         * 
         * Called when a message is received from the AI server.
         * Messages are parsed as JSON and routed to appropriate handlers.
         */
        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('[AI] Error parsing message:', e);
          }
        };

        /**
         * Error Handler
         * 
         * Called when a WebSocket error occurs.
         */
        this.socket.onerror = (error) => {
          console.error('[AI] ❌ WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        /**
         * Connection Closed Handler
         * 
         * Called when the WebSocket connection is closed.
         * Implements automatic reconnection logic if not intentionally closed.
         */
        this.socket.onclose = (event) => {
          console.log('[AI] 🔌 Connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Attempt reconnection if not intentionally closed (code 1000)
          // and we haven't exceeded max attempts
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[AI] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            // Exponential backoff: wait longer between each attempt
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
   * Handle Incoming Messages
   * 
   * Routes incoming messages to appropriate event handlers based on message type.
   * 
   * @param {object} message - Parsed JSON message from server
   * 
   * Message types:
   * - connected: Confirmation of connection
   * - processed_frame: Video frame has been processed
   * - processed_audio: Audio has been processed
   * - config_status: Configuration update confirmation
   * - pong: Response to ping (keep-alive)
   * - error: Error message from server
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
   * Send Video Frame for AI Processing
   * 
   * Sends a video frame to the AI server for processing (e.g., face swap).
   * 
   * @param {string} frameData - Base64 encoded frame data
   * @param {number} timestamp - Frame timestamp (defaults to current time)
   * 
   * Note: Only sends if currently connected
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
   * Send Audio Data for AI Processing
   * 
   * Sends audio data to the AI server for voice conversion.
   * 
   * @param {string} audioData - Base64 encoded audio data
   * @param {number} timestamp - Audio timestamp (defaults to current time)
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
   * Configure AI Processing Settings
   * 
   * Sends configuration to the AI server to enable/disable processing features.
   * 
   * @param {boolean} faceSwapEnabled - Enable or disable face swap
   * @param {boolean} voiceConvertEnabled - Enable or disable voice conversion
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
   * Send Keep-Alive Ping
   * 
   * Sends a ping message to keep the connection alive.
   * AI servers may timeout idle connections, so this should be called periodically.
   */
  ping() {
    if (!this.isConnected || !this.socket) return;

    this.socket.send(JSON.stringify({ type: 'ping' }));
  }

  /**
   * Load Face Image for Face Swapping
   * 
   * Uploads a face image to the AI server to use as the target face.
   * 
   * @param {string} imageData - Base64 encoded face image
   * @param {string} faceName - Name/identifier for the face
   * @returns {Promise} - Server response
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
   * Load Voice Model for Voice Conversion
   * 
   * Uploads/selects a voice model on the AI server.
   * 
   * @param {string} modelPath - Path to the voice model
   * @param {string} voiceName - Name/identifier for the voice
   * @returns {Promise} - Server response
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
   * Enable/Disable Face Swap
   * 
   * Toggles the face swap feature on the AI server.
   * 
   * @param {boolean} enabled - True to enable, false to disable
   * @returns {Promise} - Server response
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
   * Enable/Disable Voice Conversion
   * 
   * Toggles the voice conversion feature on the AI server.
   * 
   * @param {boolean} enabled - True to enable, false to disable
   * @returns {Promise} - Server response
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
   * Get AI Service Status
   * 
   * Fetches current status from the AI server including:
   * - Available models
   * - Current settings
   * - Processing statistics
   * 
   * @returns {Promise} - Server response with status data
   */
  async getStatus() {
    const response = await fetch(`${this.serverUrl}/api/ai/health`);
    return response.json();
  }

  /**
   * Add Event Listener
   * 
   * Registers a callback function to be called when an event occurs.
   * 
   * @param {string} event - Event name
   * @param {function} callback - Function to call when event occurs
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove Event Listener
   * 
   * Removes a previously registered callback.
   * 
   * @param {string} event - Event name
   * @param {function} callback - Function to remove
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
   * Emit Event to Listeners
   * 
   * Internal method to call all registered callbacks for an event.
   * 
   * @param {string} event - Event name
   * @param {any} data - Data to pass to callbacks
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
   * Disconnect from AI Server
   * 
   * Closes the WebSocket connection intentionally.
   * This will not trigger reconnection logic.
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
// This creates one instance that can be imported and used throughout the app
export const aiClient = new AIProcessingClient();
export default aiClient;
