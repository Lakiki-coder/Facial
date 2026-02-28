/**
 * AIControlPanel.js - AI Control Panel Component (Commented Version)
 * 
 * This component provides the user interface for controlling AI features:
 * - Face Swap: Replace your face with another face in real-time
 * - Voice Conversion: Change your voice to sound like another voice
 * 
 * It communicates with an AI backend server via WebSocket and HTTP.
 */

import React, { useState, useEffect, useRef } from 'react';
// React: Core library for building UI components
// useState: Hook for managing component state
// useEffect: Hook for side effects (connection on mount)
// useRef: Hook for referencing DOM elements

import { aiClient } from '../utils/aiProcessing';
// aiClient: Singleton instance for communicating with AI server
// This handles WebSocket connections and API calls

/**
 * AIControlPanel Component
 * 
 * @param {string} serverUrl - URL of the AI processing server
 * @param {function} onClose - Callback to close the panel
 */
const AIControlPanel = ({ serverUrl, onClose }) => {
  // Connection status to AI server
  const [isConnected, setIsConnected] = useState(false);
  
  // Face swap feature enabled/disabled
  const [faceSwapEnabled, setFaceSwapEnabled] = useState(false);
  
  // Voice conversion feature enabled/disabled
  const [voiceConvertEnabled, setVoiceConvertEnabled] = useState(false);
  
  // Currently selected face image filename
  const [selectedFace, setSelectedFace] = useState(null);
  
  // AI service status information
  const [status, setStatus] = useState(null);
  
  // Loading state for async operations
  const [isLoading, setIsLoading] = useState(false);
  
  // AI processing latency in milliseconds
  const [latency, setLatency] = useState(0);
  
  // Frames per second for AI processing
  const [fps, setFps] = useState(0);
  
  // Reference to the hidden file input element
  const fileInputRef = useRef(null);
  
  // Reference to the ping interval (for keeping connection alive)
  const pingIntervalRef = useRef(null);

  /**
   * useEffect - Connect to AI server on component mount
   * 
   * Sets up the WebSocket connection and event listeners
   * when the component first renders.
   */
  useEffect(() => {
    // Connect to AI server
    connectToAI();
    
    // Set up event listeners for AI server events
    // These fire when the AI server sends us updates
    
    // Connection established
    aiClient.on('connected', () => setIsConnected(true));
    
    // Connection lost
    aiClient.on('disconnected', () => setIsConnected(false));
    
    // Frame processed - update latency and FPS
    aiClient.on('frameProcessed', (msg) => {
      setLatency(msg.latency || 0);
      setFps(msg.fps || 0);
    });
    
    // Error occurred
    aiClient.on('error', (msg) => {
      console.error('AI Error:', msg);
    });

    // Set up periodic ping to keep connection alive
    // AI servers may timeout idle connections
    pingIntervalRef.current = setInterval(() => {
      aiClient.ping();
    }, 10000);

    // Fetch initial status from AI server
    fetchStatus();

    // Cleanup on unmount
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  /**
   * Connect to AI Server
   * 
   * Establishes a WebSocket connection to the AI backend.
   * The AI server runs on port 8080 (different from signaling server).
   */
  const connectToAI = async () => {
    try {
      // Replace port 3001 with 8080 for AI server
      await aiClient.connect(serverUrl.replace('3001', '8080'));
      console.log('Connected to AI server');
    } catch (error) {
      console.error('Failed to connect to AI server:', error);
    }
  };

  /**
   * Fetch AI Service Status
   * 
   * Gets current status from the AI server including:
   * - Available face models
   * - Available voice models
   * - Current processing settings
   */
  const fetchStatus = async () => {
    try {
      const statusData = await aiClient.getStatus();
      setStatus(statusData);
    } catch (error) {
      console.error('Failed to fetch AI status:', error);
    }
  };

  /**
   * Toggle Face Swap
   * 
   * Enables or disables the face swap feature.
   * Requires a face image to be selected first.
   */
  const handleFaceSwapToggle = async () => {
    try {
      const newValue = !faceSwapEnabled;
      setIsLoading(true);
      
      // Send request to AI server
      await aiClient.setFaceSwapEnabled(newValue);
      setFaceSwapEnabled(newValue);
      
      // Also update WebSocket configuration for real-time processing
      aiClient.configure(newValue, voiceConvertEnabled);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to toggle face swap:', error);
      setIsLoading(false);
    }
  };

  /**
   * Toggle Voice Conversion
   * 
   * Enables or disables the voice conversion feature.
   */
  const handleVoiceConvertToggle = async () => {
    try {
      const newValue = !voiceConvertEnabled;
      setIsLoading(true);
      
      // Send request to AI server
      await aiClient.setVoiceConvertEnabled(newValue);
      setVoiceConvertEnabled(newValue);
      
      // Update WebSocket configuration
      aiClient.configure(faceSwapEnabled, newValue);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to toggle voice conversion:', error);
      setIsLoading(false);
    }
  };

  /**
   * Handle Face Image Selection
   * 
   * Called when user selects an image file for face swapping.
   * Converts the image to base64 and sends it to the AI server.
   */
  const handleFaceImageSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      
      // Convert image file to base64 string
      const reader = new FileReader();
      reader.onload = async (e) => {
        // Remove the "data:image/xxx;base64," prefix
        const imageData = e.target.result.split(',')[1];
        
        // Send to AI server for processing
        await aiClient.loadFace(imageData, file.name);
        
        // Update state
        setSelectedFace(file.name);
        setFaceSwapEnabled(true);
        
        // Configure AI to use face swap
        aiClient.configure(true, voiceConvertEnabled);
        
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Failed to load face:', error);
      setIsLoading(false);
    }
  };

  /**
   * Main Render
   * 
   * Returns the JSX for the AI control panel, including:
   * - Connection status indicator
   * - Face swap controls with image upload
   * - Voice conversion toggle
   * - Performance statistics
   */
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-80">
      {/* Header with title and close button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">AI Controls</h3>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Connection Status Indicator */}
      <div className="mb-4 flex items-center">
        {/* Green dot if connected, red if not */}
        <span className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="text-sm text-gray-600">
          {isConnected ? 'AI Server Connected' : 'AI Server Disconnected'}
        </span>
      </div>

      {/* Face Swap Controls Section */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-700">Face Swap</span>
          {/* Toggle switch */}
          <button
            onClick={handleFaceSwapToggle}
            disabled={isLoading || !selectedFace}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              faceSwapEnabled ? 'bg-blue-600' : 'bg-gray-300'
            } ${(!selectedFace || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                faceSwapEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        {/* Face Image Upload Button */}
        <div className="mt-2">
          {/* Hidden file input - triggered by button click */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFaceImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {selectedFace ? `Selected: ${selectedFace}` : 'Select Target Face'}
          </button>
        </div>
        
        {/* Show selected face name */}
        {selectedFace && (
          <div className="mt-2 text-xs text-green-600">
            ✓ Face loaded: {selectedFace}
          </div>
        )}
      </div>

      {/* Voice Conversion Controls Section */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">Voice Conversion</span>
          {/* Toggle switch */}
          <button
            onClick={handleVoiceConvertToggle}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              voiceConvertEnabled ? 'bg-blue-600' : 'bg-gray-300'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                voiceConvertEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Performance Statistics Display */}
      <div className="p-3 bg-gray-800 text-green-400 rounded-lg font-mono text-xs">
        <div className="flex justify-between">
          <span>Latency:</span>
          <span>{latency}ms</span>
        </div>
        <div className="flex justify-between">
          <span>FPS:</span>
          <span>{fps.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span>Status:</span>
          <span>{status?.status || 'N/A'}</span>
        </div>
      </div>

      {/* Refresh Status Button */}
      <button
        onClick={fetchStatus}
        className="w-full mt-4 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
      >
        Refresh Status
      </button>
    </div>
  );
};

// Export component for use in VideoCall.js
export default AIControlPanel;
