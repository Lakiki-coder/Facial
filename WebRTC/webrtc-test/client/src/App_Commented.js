/**
 * App.js - Main Application Component (Commented Version)
 * 
 * This is the root component of the WebRTC Video Call application.
 * It handles:
 * - Server health checking
 * - Room creation and joining
 * - User authentication (generating unique user IDs)
 * - Navigation between Room and VideoCall components
 */

import React, { useState, useEffect } from 'react';
// React: Core library for building UI
// useState: Hook for managing component state
// useEffect: Hook for side effects (API calls on mount)

import VideoCall from './components/VideoCall';
// VideoCall: Component that handles the actual video call with WebRTC

import Room from './components/Room';
// Room: Component for creating and joining video call rooms

import axios from 'axios';
// axios: HTTP client for making API requests to the signaling server

/**
 * Server URL Configuration
 * 
 * Automatically detects the correct server URL based on how the user accesses the app:
 * - If accessed from localhost/127.0.0.1: Use http://localhost:3001
 * - If accessed from another computer (via IP): Use http://<IP>:3001
 * 
 * This enables cross-computer testing without code changes.
 */
const SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : `http://${window.location.hostname}:3001`;

/**
 * Main App Component
 * 
 * This is the root component that manages:
 * - roomId: Current room the user is in (null if not in a call)
 * - userId: Unique identifier for this user (generated on first load)
 * - serverStatus: Connection status to signaling server
 * - error: Any error messages to display
 */
function App() {
  // State for current room ID (null = not in a call)
  const [roomId, setRoomId] = useState(null);
  
  // Generate unique user ID on first render
  // Format: "user_" + random string (e.g., "user_abc123xyz")
  const [userId] = useState(() => 'user_' + Math.random().toString(36).substr(2, 9));
  
  // Server connection status: 'checking', 'connected', or 'disconnected'
  const [serverStatus, setServerStatus] = useState('checking');
  
  // Error message to display to user
  const [error, setError] = useState(null);

  /**
   * useEffect - Check server health on component mount
   * 
   * Runs once when the component first mounts (empty dependency array).
   * Makes an HTTP request to the server's /health endpoint to verify connectivity.
   */
  useEffect(() => {
    checkServerHealth();
  }, []);

  /**
   * Check Server Health
   * 
   * Pings the signaling server to verify it's running and accessible.
   * Updates serverStatus accordingly.
   */
  const checkServerHealth = async () => {
    try {
      // Make GET request to health endpoint
      const response = await axios.get(`${SERVER_URL}/health`);
      
      // Server is responding
      setServerStatus('connected');
      console.log('Server health:', response.data);
    } catch (error) {
      // Server is not reachable
      console.error('Server health check failed:', error);
      setServerStatus('disconnected');
      setError('Cannot connect to signaling server. Make sure it\'s running on port 3001 with HTTPS');
    }
  };

  /**
   * Create New Room
   * 
   * Makes a POST request to the server to create a new room.
   * Returns the new room ID.
   */
  const createRoom = async () => {
    try {
      // POST to /api/rooms creates a new room
      const response = await axios.post(`${SERVER_URL}/api/rooms`);
      
      // Update state with new room ID
      setRoomId(response.data.roomId);
      setError(null);
      
      // Return room ID for use by caller
      return response.data.roomId;
    } catch (error) {
      setError('Failed to create room');
      console.error('Error creating room:', error);
    }
  };

  /**
   * Join Existing Room
   * 
   * Called when user submits the join room form.
   * Extracts room ID from form input and updates state.
   */
  const joinRoom = (e) => {
    e.preventDefault(); // Prevent form submission from reloading page
    
    // Get room ID from form input
    const inputRoomId = e.target.roomId.value;
    
    // If room ID is provided, join the room
    if (inputRoomId) {
      setRoomId(inputRoomId);
      setError(null);
    }
  };

  /**
   * Leave Room
   * 
   * Resets room state when user wants to leave the call.
   * This triggers the component to show the Room component again.
   */
  const leaveRoom = () => {
    setRoomId(null);
  };

  /**
   * Loading Screen
   * 
   * Shown while checking server connection status.
   * Displays a spinning animation while connecting.
   */
  if (serverStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          {/* Spinning loading animation */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Connecting to signaling server...</p>
        </div>
      </div>
    );
  }

  /**
   * Error Screen
   * 
   * Shown when server is not reachable.
   * Provides a retry button to attempt connection again.
   */
  if (serverStatus === 'disconnected') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          {/* Error icon */}
          <div className="text-red-500 text-center mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-center mb-2">Connection Error</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={checkServerHealth}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  /**
   * Main Application UI
   * 
   * Rendered when server is connected.
   * Shows navigation bar and either:
   * - Room component (if not in a call)
   * - VideoCall component (if in a call)
   */
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* App Title */}
              <h1 className="text-xl font-semibold text-gray-800">WebRTC Video Test</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Display User ID */}
              <span className="text-sm text-gray-600">User ID: {userId}</span>
              
              {/* Leave Room Button (only shown when in a call) */}
              {roomId && (
                <button
                  onClick={leaveRoom}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
                >
                  Leave Room
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Conditional Rendering */}
        {!roomId ? (
          /* Show Room component if not in a call */
          <Room 
            onCreateRoom={createRoom} 
            onJoinRoom={joinRoom} 
            error={error} 
          />
        ) : (
          /* Show VideoCall component if in a call */
          <VideoCall 
            roomId={roomId} 
            userId={userId} 
            onLeave={leaveRoom}
            serverUrl={SERVER_URL}
          />
        )}
      </main>
    </div>
  );
}

// Export component for use in index.js
export default App;
