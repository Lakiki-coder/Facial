import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import AIControlPanel from './AIControlPanel';

const VideoCall = ({ roomId, userId, onLeave, serverUrl }) => {
  const [peers, setPeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [socketId, setSocketId] = useState('');
  
  // AI States
  const [aiLatency, setAiLatency] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  
  // AI Server URL (runs on port 8080)
  const aiServerUrl = serverUrl.replace('3001', '8080');
  
  const socketRef = useRef();
  const peersRef = useRef([]);
  const localVideoRef = useRef();
  const remoteVideosRef = useRef(new Map());

  useEffect(() => {
    console.log('Initializing VideoCall with roomId:', roomId, 'userId:', userId);
    console.log('Connecting to server:', serverUrl);
    
    // Connect to signaling server with HTTPS
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true
    });

    // Socket connection event handlers
    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected with ID:', socketRef.current.id);
      setSocketId(socketRef.current.id);
      setConnectionStatus('connected');
      
      // Get user media with better error handling
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: "user",
          resizeMode: "crop-and-scale"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 2,
          sampleRate: 48000
        }
      };

      console.log('Requesting media with constraints:', constraints);

      navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
          console.log('✅ Got local stream');
          console.log('Video tracks:', stream.getVideoTracks().length);
          console.log('Audio tracks:', stream.getAudioTracks().length);
          
          stream.getVideoTracks().forEach(track => {
            console.log('Video track settings:', track.getSettings());
          });
          
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          // Join room after getting stream
          console.log('Emitting join-room event:', { roomId, userId });
          socketRef.current.emit('join-room', { roomId, userId });
        })
        .catch(error => {
          console.error('❌ Error accessing media devices:', error);
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          
          setConnectionStatus('error');
          
          // Show user-friendly message based on error
          if (error.name === 'NotAllowedError' || error.message.includes('perm')) {
            alert('Camera access denied. Please allow camera and microphone access.\n\nClick the camera icon in the address bar and select "Allow".');
          } else if (error.name === 'NotFoundError') {
            alert('No camera or microphone found. Please connect a camera and try again.');
          } else if (error.name === 'NotReadableError' || error.message.includes('starting')) {
            alert('Camera is already in use by another application. Please close other apps using the camera (Zoom, Teams, etc.) and refresh.');
          } else if (error.name === 'AbortError') {
            alert('Failed to start camera. This might be a driver issue. Try:\n1. Restart your browser\n2. Check if camera works in other apps\n3. Update camera drivers');
          } else {
            alert(`Could not access camera/microphone: ${error.message}`);
          }
        });
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setConnectionStatus('error');
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionStatus('connecting');
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
    });

    // Room events
    socketRef.current.on('room-joined', ({ participants, isHost }) => {
      console.log('✅ Successfully joined room! Participants:', participants);
      setConnectionStatus('connected');
      
      // Create peer connections for existing participants
      participants.forEach(participant => {
        console.log('Creating peer for existing participant:', participant);
        if (participant.socketId !== socketRef.current.id) {
          createPeer(participant.socketId, true);
        }
      });
    });

    socketRef.current.on('user-connected', ({ userId, socketId }) => {
      console.log('👤 User connected:', userId, socketId);
      if (socketId !== socketRef.current.id) {
        createPeer(socketId, false);
      }
    });

    socketRef.current.on('user-disconnected', ({ socketId, userId }) => {
      console.log('👤 User disconnected:', userId);
      
      // Remove peer
      const peerIndex = peersRef.current.findIndex(p => p.peerID === socketId);
      if (peerIndex !== -1) {
        peersRef.current[peerIndex].peer.destroy();
        peersRef.current.splice(peerIndex, 1);
      }
      
      // Remove remote video
      const videoElement = remoteVideosRef.current.get(socketId);
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.remove();
        remoteVideosRef.current.delete(socketId);
      }

      setPeers(peersRef.current.map(p => p.peerID));
      setRemoteStreams(new Map(remoteVideosRef.current));
    });

    // WebRTC signaling events
    socketRef.current.on('offer', ({ offer, from }) => {
      console.log('📞 Received offer from:', from);
      const peerExists = peersRef.current.find(p => p.peerID === from);
      if (!peerExists) {
        createPeer(from, false, offer);
      }
    });

    socketRef.current.on('answer', ({ answer, from }) => {
      console.log('📞 Received answer from:', from);
      const peer = peersRef.current.find(p => p.peerID === from);
      if (peer) {
        peer.peer.signal(answer);
      }
    });

    socketRef.current.on('ice-candidate', ({ candidate, from }) => {
      console.log('📞 Received ICE candidate from:', from);
      const peer = peersRef.current.find(p => p.peerID === from);
      if (peer && candidate) {
        peer.peer.signal(candidate);
      }
    });

    socketRef.current.on('error', ({ message }) => {
      console.error('Room error:', message);
      
      if (message === 'Room not found') {
        alert('This room no longer exists. Please create a new room.');
        setTimeout(() => onLeave(), 2000);
      } else if (message === 'Room is full') {
        alert('This room is full. Please try another room or create a new one.');
        setTimeout(() => onLeave(), 2000);
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up VideoCall component');
      
      peersRef.current.forEach(peer => {
        if (peer.peer) {
          peer.peer.destroy();
        }
      });
      
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, userId, serverUrl]);

  const createPeer = (targetSocketId, initiator, offer = null) => {
    if (!localStream) {
      console.log('No local stream yet, waiting...');
      return;
    }

    console.log('Creating peer connection:', {
      target: targetSocketId,
      initiator,
      hasOffer: !!offer
    });

    const peer = new Peer({
      initiator: initiator,
      stream: localStream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      }
    });

    peersRef.current.push({
      peerID: targetSocketId,
      peer: peer
    });

    setPeers(peersRef.current.map(p => p.peerID));

    peer.on('signal', signal => {
      console.log('📡 Signal from peer:', targetSocketId, signal.type);
      
      if (initiator && !offer) {
        socketRef.current.emit('offer', {
          offer: signal,
          to: targetSocketId,
          from: socketRef.current.id
        });
      } else if (offer && signal.type === 'answer') {
        socketRef.current.emit('answer', {
          answer: signal,
          to: targetSocketId,
          from: socketRef.current.id
        });
      } else if (signal.type === 'candidate') {
        socketRef.current.emit('ice-candidate', {
          candidate: signal,
          to: targetSocketId,
          from: socketRef.current.id
        });
      }
    });

    peer.on('stream', stream => {
      console.log('🎥 Received stream from peer:', targetSocketId);
      
      let videoElement = remoteVideosRef.current.get(targetSocketId);
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.id = `remote-video-${targetSocketId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.className = "w-full h-full object-cover";
        remoteVideosRef.current.set(targetSocketId, videoElement);
      }
      
      videoElement.srcObject = stream;
      setRemoteStreams(new Map(remoteVideosRef.current));
    });

    peer.on('connect', () => {
      console.log('✅ Peer connection established with:', targetSocketId);
    });

    peer.on('error', err => {
      console.error('❌ Peer error with', targetSocketId, ':', err);
    });

    peer.on('close', () => {
      console.log('🔒 Peer connection closed with:', targetSocketId);
    });

    if (offer) {
      console.log('Signaling offer to peer');
      peer.signal(offer);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const getConnectionStatusColor = () => {
    switch(connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`h-3 w-3 rounded-full ${getConnectionStatusColor()}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 'Error'}
            </span>
            <span className="text-sm text-gray-600">
              Room: <span className="font-mono font-bold">{roomId}</span>
            </span>
            <span className="text-sm text-gray-600">
              Users: <span className="font-bold">{peers.length + 1}</span>
            </span>
          </div>
          <button
            onClick={onLeave}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition text-sm"
          >
            Leave Call
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Video */}
        <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            You {!isVideoEnabled && '(Video Off)'} {!isAudioEnabled && '(Muted)'}
          </div>
        </div>

        {/* Remote Videos */}
        {Array.from(remoteStreams).map(([socketId, videoElement]) => (
          <div key={socketId} className="bg-black rounded-lg overflow-hidden relative aspect-video">
            <video
              ref={el => {
                if (el && videoElement && !el.srcObject) {
                  el.srcObject = videoElement.srcObject;
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              Peer {socketId.substring(0, 8)}
            </div>
          </div>
        ))}

        {/* Placeholder for empty grid */}
        {peers.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400 flex items-center justify-center min-h-[200px] aspect-video">
            <div>
              <p>Waiting for others to join...</p>
              <p className="text-sm text-gray-500 mt-2">Share this room ID: {roomId}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex justify-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full ${
              isAudioEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'
            } text-white transition`}
          >
            {isAudioEnabled ? '🔊' : '🔇'}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${
              isVideoEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'
            } text-white transition`}
          >
            {isVideoEnabled ? '📹' : '🚫'}
          </button>

          {/* AI Controls Button */}
          <button
            onClick={() => setShowAIPanel(!showAIPanel)}
            className={`p-3 rounded-full ${
              showAIPanel ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'
            } text-white transition`}
            title="AI Controls"
          >
            🤖
          </button>
        </div>
      </div>

      {/* AI Control Panel */}
      {showAIPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <AIControlPanel 
            serverUrl={aiServerUrl} 
            onClose={() => setShowAIPanel(false)} 
          />
        </div>
      )}

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-800 text-green-400 p-4 rounded-lg font-mono text-xs">
          <div>Socket: {socketId || 'Not connected'}</div>
          <div>Status: {connectionStatus}</div>
          <div>Peers: {peers.length}</div>
          <div>AI Server: ❌ Disconnected</div>
          <div>AI Latency: Error</div>
          <div>Processing: 🟢 Idle</div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;