import React, { useState, useEffect } from 'react';
import VideoCall from './components/VideoCall';
import Room from './components/Room';
import axios from 'axios';

// Use your IP address here
const SERVER_URL = 'https://172.16.0.125:3001';

function App() {
  const [roomId, setRoomId] = useState(null);
  const [userId] = useState(() => 'user_' + Math.random().toString(36).substr(2, 9));
  const [serverStatus, setServerStatus] = useState('checking');
  const [error, setError] = useState(null);

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/health`);
      setServerStatus('connected');
      console.log('Server health:', response.data);
    } catch (error) {
      console.error('Server health check failed:', error);
      setServerStatus('disconnected');
      setError('Cannot connect to signaling server. Make sure it\'s running on port 3001 with HTTPS');
    }
  };

  const createRoom = async () => {
    try {
      const response = await axios.post(`${SERVER_URL}/api/rooms`);
      setRoomId(response.data.roomId);
      setError(null);
      return response.data.roomId;
    } catch (error) {
      setError('Failed to create room');
      console.error('Error creating room:', error);
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    const inputRoomId = e.target.roomId.value;
    if (inputRoomId) {
      setRoomId(inputRoomId);
      setError(null);
    }
  };

  const leaveRoom = () => {
    setRoomId(null);
  };

  if (serverStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Connecting to signaling server...</p>
        </div>
      </div>
    );
  }

  if (serverStatus === 'disconnected') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
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

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-800">WebRTC Video Test</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">User ID: {userId}</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!roomId ? (
          <Room onCreateRoom={createRoom} onJoinRoom={joinRoom} error={error} />
        ) : (
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

export default App;