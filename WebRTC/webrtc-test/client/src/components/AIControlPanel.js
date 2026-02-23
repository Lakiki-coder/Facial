import React, { useState, useEffect, useRef } from 'react';
import { aiClient } from '../utils/aiProcessing';

/**
 * AI Control Panel Component
 * Allows users to control face swap and voice conversion settings
 */
const AIControlPanel = ({ serverUrl, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [faceSwapEnabled, setFaceSwapEnabled] = useState(false);
  const [voiceConvertEnabled, setVoiceConvertEnabled] = useState(false);
  const [selectedFace, setSelectedFace] = useState(null);
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latency, setLatency] = useState(0);
  const [fps, setFps] = useState(0);
  
  const fileInputRef = useRef(null);
  const pingIntervalRef = useRef(null);

  // Connect to AI server on mount
  useEffect(() => {
    connectToAI();
    
    // Set up event listeners
    aiClient.on('connected', () => setIsConnected(true));
    aiClient.on('disconnected', () => setIsConnected(false));
    aiClient.on('frameProcessed', (msg) => {
      setLatency(msg.latency || 0);
      setFps(msg.fps || 0);
    });
    aiClient.on('error', (msg) => {
      console.error('AI Error:', msg);
    });

    // Ping to keep connection alive
    pingIntervalRef.current = setInterval(() => {
      aiClient.ping();
    }, 10000);

    // Fetch initial status
    fetchStatus();

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  const connectToAI = async () => {
    try {
      await aiClient.connect(serverUrl.replace('3001', '8080'));
      console.log('Connected to AI server');
    } catch (error) {
      console.error('Failed to connect to AI server:', error);
    }
  };

  const fetchStatus = async () => {
    try {
      const statusData = await aiClient.getStatus();
      setStatus(statusData);
    } catch (error) {
      console.error('Failed to fetch AI status:', error);
    }
  };

  const handleFaceSwapToggle = async () => {
    try {
      const newValue = !faceSwapEnabled;
      setIsLoading(true);
      
      await aiClient.setFaceSwapEnabled(newValue);
      setFaceSwapEnabled(newValue);
      
      // Also update WebSocket config
      aiClient.configure(newValue, voiceConvertEnabled);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to toggle face swap:', error);
      setIsLoading(false);
    }
  };

  const handleVoiceConvertToggle = async () => {
    try {
      const newValue = !voiceConvertEnabled;
      setIsLoading(true);
      
      await aiClient.setVoiceConvertEnabled(newValue);
      setVoiceConvertEnabled(newValue);
      
      // Also update WebSocket config
      aiClient.configure(faceSwapEnabled, newValue);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to toggle voice conversion:', error);
      setIsLoading(false);
    }
  };

  const handleFaceImageSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target.result.split(',')[1]; // Remove data URL prefix
        
        await aiClient.loadFace(imageData, file.name);
        setSelectedFace(file.name);
        setFaceSwapEnabled(true);
        
        // Configure AI
        aiClient.configure(true, voiceConvertEnabled);
        
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Failed to load face:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-80">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">AI Controls</h3>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Connection Status */}
      <div className="mb-4 flex items-center">
        <span className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="text-sm text-gray-600">
          {isConnected ? 'AI Server Connected' : 'AI Server Disconnected'}
        </span>
      </div>

      {/* Face Swap Controls */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-700">Face Swap</span>
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
        
        {/* Face Image Upload */}
        <div className="mt-2">
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
        
        {selectedFace && (
          <div className="mt-2 text-xs text-green-600">
            ✓ Face loaded: {selectedFace}
          </div>
        )}
      </div>

      {/* Voice Conversion Controls */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">Voice Conversion</span>
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

      {/* Performance Stats */}
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

export default AIControlPanel;
