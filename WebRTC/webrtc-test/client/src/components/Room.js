import React, { useState } from 'react';

const Room = ({ onCreateRoom, onJoinRoom, error }) => {
  const [roomId, setRoomId] = useState('');
  const [lastCreatedRoom, setLastCreatedRoom] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleCreateRoom = async () => {
    try {
      const newRoomId = await onCreateRoom();
      setLastCreatedRoom(newRoomId);
      
      // Copy to clipboard automatically
      await navigator.clipboard.writeText(newRoomId);
      setIsCopied(true);
      
      // Reset copied status after 3 seconds
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      onJoinRoom(e);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Video Call Test</h2>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Success Message - New Room Created */}
        {lastCreatedRoom && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">Room Created Successfully!</span>
              </div>
              <button
                onClick={() => copyToClipboard(lastCreatedRoom)}
                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition"
              >
                {isCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            
            <div className="bg-green-100 p-3 rounded-lg mb-2">
              <div className="text-xs text-green-600 mb-1">Room ID:</div>
              <div className="font-mono font-bold text-lg text-green-800 break-all">
                {lastCreatedRoom}
              </div>
            </div>
            
            <div className="flex items-center text-xs text-green-600">
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Share this ID with others to join. It has been copied to your clipboard.</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Create Room Button */}
          <div>
            <button
              onClick={handleCreateRoom}
              className="w-full bg-blue-500 text-white py-4 px-4 rounded-lg hover:bg-blue-600 transition font-medium text-lg shadow-md hover:shadow-lg flex items-center justify-center"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Room
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Creates a new unique room ID for you to share
            </p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500 font-medium">Or join existing</span>
            </div>
          </div>

          {/* Join Room Form */}
          <form onSubmit={handleJoinSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="roomId" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Room ID
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="roomId"
                    name="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="e.g., a8869507"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  {roomId && (
                    <button
                      type="button"
                      onClick={() => setRoomId('')}
                      className="px-3 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              
              <button
                type="submit"
                disabled={!roomId.trim()}
                className={`w-full py-4 px-4 rounded-lg font-medium text-lg transition flex items-center justify-center ${
                  roomId.trim() 
                    ? 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                Join Room
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Instructions Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-3 flex items-center">
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How to Test WebRTC:
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 mr-3 text-sm font-bold">1</div>
            <div className="text-sm text-blue-700">
              <span className="font-medium">Create a room</span> — Click the "Create New Room" button above
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 mr-3 text-sm font-bold">2</div>
            <div className="text-sm text-blue-700">
              <span className="font-medium">Copy the Room ID</span> — It's automatically copied to your clipboard
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 mr-3 text-sm font-bold">3</div>
            <div className="text-sm text-blue-700">
              <span className="font-medium">Open a second tab</span> — Open a new tab or window with the same URL
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 mr-3 text-sm font-bold">4</div>
            <div className="text-sm text-blue-700">
              <span className="font-medium">Paste and join</span> — Paste the Room ID and click "Join Room"
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 mr-3 text-sm font-bold">5</div>
            <div className="text-sm text-blue-700">
              <span className="font-medium">Allow camera/mic</span> — Grant permissions in both tabs
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mt-4 pt-4 border-t border-blue-200">
          <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Quick Tips:</h4>
          <ul className="text-xs text-blue-600 space-y-1">
            <li>• Use different browsers (Chrome + Firefox) for best testing</li>
            <li>• Check browser console (F12) for any errors</li>
            <li>• Make sure signaling server is running on port 3001</li>
            <li>• Rooms expire after 10 minutes of inactivity</li>
          </ul>
        </div>
      </div>

      {/* Recent Rooms History (Optional) */}
      {lastCreatedRoom && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recently Created Room:
          </h4>
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
            <code className="text-sm font-mono text-gray-800">{lastCreatedRoom}</code>
            <button
              onClick={() => copyToClipboard(lastCreatedRoom)}
              className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200 transition"
            >
              {isCopied ? '✓ Copied' : 'Copy Again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Room;