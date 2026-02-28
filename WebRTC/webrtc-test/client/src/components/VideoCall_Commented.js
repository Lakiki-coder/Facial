/**
 * VideoCall.js - Detailed Commented Version
 * 
 * This component handles real-time video calls using WebRTC and Socket.io.
 * It manages peer-to-peer connections, media streams, and signaling.
 */

import React, { useEffect, useRef, useState } from 'react';
// React library for building UI components
// useEffect: Hook for side effects (like socket connections)
// useRef: Hook for persisting values without re-rendering
// useState: Hook for managing component state

import io from 'socket.io-client';
// Socket.io client for real-time communication with the signaling server

import Peer from 'simple-peer';
// Simple-peer library for simplified WebRTC peer connections

import AIControlPanel from './AIControlPanel';
// AI Control Panel component for face swap and voice change features

/**
 * Main VideoCall Component
 * 
 * @param {string} roomId - The unique room identifier for the call
 * @param {string} userId - The unique user identifier 
 * @param {function} onLeave - Callback function to leave the room
 * @param {string} serverUrl - The URL of the signaling server
 */
const VideoCall = ({ roomId, userId, onLeave, serverUrl }) => {
  
  // ===== STATE MANAGEMENT =====
  // React state variables for UI updates
  
  // Array to store peer connection IDs - tracks how many other users are connected
  const [peers, setPeers] = useState([]);
  
  // The local user's media stream (camera and microphone)
  const [localStream, setLocalStream] = useState(null);
  
  // Map to store remote users' video streams (key: socketId, value: video stream)
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  
  // Boolean to track if audio is enabled/disabled
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  // Boolean to track if video is enabled/disabled
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  // Connection status: 'connecting', 'connected', or 'error'
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // The socket ID assigned by the server
  const [socketId, setSocketId] = useState('');
  
  // ===== AI FEATURE STATES =====
  // Latency measurement for AI processing (in milliseconds)
  const [aiLatency, setAiLatency] = useState(0);
  
  // Boolean to track if AI processing is active
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Boolean to show/hide the AI control panel
  const [showAIPanel, setShowAIPanel] = useState(false);
  
  // ===== COMPUTED VALUES =====
  // AI server runs on port 8080 (different from signaling server on 3001)
  // This URL is used for AI processing requests (face swap, voice change)
  const aiServerUrl = serverUrl.replace('3001', '8080');
  
  // ===== REF VARIABLES =====
  // useRef persists values without causing re-renders
  // These are used for values that change frequently but don't need immediate UI updates
  
  // Reference to the socket.io connection
  const socketRef = useRef();
  
  // Array to store peer connection objects (includes the Peer instance)
  const peersRef = useRef([]);
  
  // Reference to the local video HTML element
  const localVideoRef = useRef();
  
  // Reference to the local stream - used for immediate access in callbacks
  // This solves the issue where React state hasn't updated yet when creating peers
  const localStreamRef = useRef(null);
  
  // Map to store remote video HTML elements
  const remoteVideosRef = useRef(new Map());

  /**
   * useEffect - Main initialization hook
   * 
   * This runs once when the component mounts.
   * Sets up socket connection, media devices, and event listeners.
   */
  useEffect(() => {
    console.log('Initializing VideoCall with roomId:', roomId, 'userId:', userId);
    console.log('Connecting to server:', serverUrl);
    
    /**
     * Socket.io Connection Setup
     * 
     * We connect to the signaling server which handles:
     * - Room management (creating/joining rooms)
     * - WebRTC signaling (exchanging offers, answers, ICE candidates)
     * - User presence (who joined/left)
     */
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling'],      // Try WebSocket first, fallback to HTTP polling
      reconnectionAttempts: 5,                    // Retry connection 5 times if it fails
      reconnectionDelay: 1000,                     // Wait 1 second between retry attempts
      timeout: 20000,                             // Connection timeout: 20 seconds
      forceNew: true                              // Force creation of new connection
    });

    /**
     * Socket Connection Event Handler
     * 
     * Triggered when successfully connected to the signaling server.
     * At this point, we request access to the user's camera and microphone.
     */
    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected with ID:', socketRef.current.id);
      setSocketId(socketRef.current.id);         // Save our socket ID for display
      setConnectionStatus('connected');           // Update UI status
      
      /**
       * Media Stream Constraints
       * 
       * These settings define what media we want to capture:
       * - Video: 640x480 resolution at 30fps, facing the user (front camera)
       * - Audio: Echo cancellation, noise suppression, auto gain control enabled
       */
      const constraints = {
        video: {
          width: { ideal: 640 },                  // Ideal width: 640px
          height: { ideal: 480 },                 // Ideal height: 480px
          frameRate: { ideal: 30 },               // Ideal frame rate: 30fps
          facingMode: "user",                     // Use front-facing camera
          resizeMode: "crop-and-scale"            // Crop/scale to fit if needed
        },
        audio: {
          echoCancellation: true,                 // Reduce echo
          noiseSuppression: true,                  // Reduce background noise
          autoGainControl: true,                   // Automatically adjust volume
          channelCount: 2,                         // Stereo audio
          sampleRate: 48000                        // High quality audio
        }
      };

      console.log('Requesting media with constraints:', constraints);

      /**
       * Request User Media
       * 
       * navigator.mediaDevices.getUserMedia() prompts the user for permission
       * and returns a MediaStream containing video and/or audio tracks.
       */
      navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
          // Successfully got the media stream
          console.log('✅ Got local stream');
          console.log('Video tracks:', stream.getVideoTracks().length);
          console.log('Audio tracks:', stream.getAudioTracks().length);
          
          // Log video track settings for debugging
          stream.getVideoTracks().forEach(track => {
            console.log('Video track settings:', track.getSettings());
          });
          
          // Update React state with the stream
          setLocalStream(stream);
          
          // ALSO update the ref for immediate access in callbacks
          // This is critical for peer connection creation timing
          localStreamRef.current = stream;
          
          // Attach stream to the video element for local preview
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          // Tell the server we've joined the room
          console.log('Emitting join-room event:', { roomId, userId });
          socketRef.current.emit('join-room', { roomId, userId });
        })
        .catch(error => {
          // Error getting user media
          console.error('❌ Error accessing media devices:', error);
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          
          setConnectionStatus('error');
          
          /**
           * Error Handling for Different Camera/Microphone Issues
           * 
           * NotAllowedError: User denied permission
           * NotFoundError: No camera/microphone found
           * NotReadableError: Camera is in use by another app
           * AbortError: Hardware/driver issue
           */
          if (error.name === 'NotAllowedError' || error.message.includes('perm')) {
            alert('Camera access denied. Please allow camera and microphone access.\n\nClick the camera icon in the address bar and select "Allow".');
          } else if (error.name === 'NotFoundError') {
            alert('No camera or microphone found. Please connect a camera and try again.');
          } else if (error.name === 'NotReadableError' || error.message.includes('starting')) {
            // Camera is in use by another application - try audio only
            console.log('Camera in use, trying audio-only mode...');
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
              .then(audioStream => {
                console.log('✅ Got audio-only stream');
                setLocalStream(audioStream);
                localStreamRef.current = audioStream; // Update ref
                setIsVideoEnabled(false);
                socketRef.current.emit('join-room', { roomId, userId });
                alert('Camera is in use. You joined with audio only. Use a different browser for video.');
              })
              .catch(audioError => {
                console.error('Audio also failed:', audioError);
                alert('Camera and microphone are both in use. Please:\n1. Close other apps using camera/mic\n2. Or use a different browser (Chrome vs Firefox)');
              });
          } else if (error.name === 'AbortError') {
            // Camera failed to start - try audio only
            console.log('Camera failed (AbortError), trying audio-only mode...');
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
              .then(audioStream => {
                console.log('✅ Got audio-only stream');
                setLocalStream(audioStream);
                localStreamRef.current = audioStream;
                setIsVideoEnabled(false);
                socketRef.current.emit('join-room', { roomId, userId });
                alert('Camera failed to start. You joined with audio only.');
              })
              .catch(audioError => {
                alert('Failed to start camera. This might be a driver issue. Try:\n1. Restart your browser\n2. Check if camera works in other apps\n3. Update camera drivers');
              });
          } else {
            alert(`Could not access camera/microphone: ${error.message}`);
          }
        });
    });

    // Handle socket connection errors
    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setConnectionStatus('error');
    });

    // Handle socket disconnection
    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionStatus('connecting');
    });

    // Handle socket reconnection
    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
    });

    /**
     * Room Joined Event
     * 
     * Received from server when we've successfully joined a room.
     * Contains list of existing participants we need to connect to.
     */
    socketRef.current.on('room-joined', ({ participants, isHost }) => {
      console.log('✅ Successfully joined room! Participants:', participants);
      setConnectionStatus('connected');
      
      // For each existing participant, create a peer connection
      // We are the "initiator" - we start the connection
      participants.forEach(participant => {
        console.log('Creating peer for existing participant:', participant);
        if (participant.socketId !== socketRef.current.id) {
          createPeer(participant.socketId, true); // true = we initiate the connection
        }
      });
    });

    /**
     * User Connected Event
     * 
     * Received when another user joins the room.
     * We need to create a peer connection to them.
     */
    socketRef.current.on('user-connected', ({ userId, socketId }) => {
      console.log('👤 User connected event received:', userId, socketId);
      console.log('My socket ID:', socketRef.current.id);
      console.log('Local stream exists:', !!localStreamRef.current);
      
      // Don't connect to ourselves
      if (socketId !== socketRef.current.id) {
        console.log('Creating peer for:', socketId);
        createPeer(socketId, false); // false = they will initiate
      }
    });

    /**
     * User Disconnected Event
     * 
     * Received when another user leaves the room.
     * Clean up their peer connection and video element.
     */
    socketRef.current.on('user-disconnected', ({ socketId, userId }) => {
      console.log('👤 User disconnected:', userId);
      
      // Find and destroy the peer connection
      const peerIndex = peersRef.current.findIndex(p => p.peerID === socketId);
      if (peerIndex !== -1) {
        peersRef.current[peerIndex].peer.destroy();
        peersRef.current.splice(peerIndex, 1);
      }
      
      // Remove their video element
      const videoElement = remoteVideosRef.current.get(socketId);
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.remove();
        remoteVideosRef.current.delete(socketId);
      }

      // Update state
      setPeers(peersRef.current.map(p => p.peerID));
      setRemoteStreams(new Map(remoteVideosRef.current));
    });

    /**
     * WebRTC Signaling Events
     * 
     * These events handle the actual WebRTC connection setup:
     * - offer: Initial connection request (sent by initiator)
     * - answer: Response to an offer (sent by receiver)
     * - ice-candidate: Network information for NAT traversal
     */

    // Received an offer from another peer
    socketRef.current.on('offer', ({ offer, from }) => {
      console.log('📞 Received offer from:', from);
      const peerExists = peersRef.current.find(p => p.peerID === from);
      if (!peerExists) {
        createPeer(from, false, offer); // Create peer with the offer
      }
    });

    // Received an answer from another peer
    socketRef.current.on('answer', ({ answer, from }) => {
      console.log('📞 Received answer from:', from);
      const peer = peersRef.current.find(p => p.peerID === from);
      if (peer) {
        peer.peer.signal(answer); // Signal the answer to complete handshake
      }
    });

    // Received an ICE candidate
    socketRef.current.on('ice-candidate', ({ candidate, from }) => {
      console.log('📞 Received ICE candidate from:', from);
      const peer = peersRef.current.find(p => p.peerID === from);
      if (peer && candidate) {
        peer.peer.signal(candidate);
      }
    });

    // Handle room errors
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

    /**
     * Cleanup Function
     * 
     * Called when component unmounts (user leaves the call).
     * Stops all media tracks and disconnects sockets/peers.
     */
    return () => {
      console.log('Cleaning up VideoCall component');
      
      // Destroy all peer connections
      peersRef.current.forEach(peer => {
        if (peer.peer) {
          peer.peer.destroy();
        }
      });
      
      // Stop all local media tracks (releases camera/microphone)
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      // Disconnect from socket server
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, userId, serverUrl]); // Re-run if these values change

  /**
   * Create Peer Connection
   * 
   * Sets up a WebRTC peer connection with another user.
   * Uses SimplePeer library which handles the complex WebRTC handshake.
   * 
   * @param {string} targetSocketId - The socket ID of the user to connect to
   * @param {boolean} initiator - True if we initiate the connection, false if we respond
   * @param {object} offer - Optional offer signal if we're responding
   */
  const createPeer = (targetSocketId, initiator, offer = null) => {
    // Check if we have a local stream available
    // Use the ref for immediate access (state may not be updated yet)
    if (!localStreamRef.current) {
      console.log('No local stream yet, waiting...');
      return;
    }

    console.log('Creating peer connection:', {
      target: targetSocketId,
      initiator,
      hasOffer: !!offer
    });

    /**
     * Create SimplePeer Instance
     * 
     * SimplePeer handles the WebRTC complexity:
     * - ICE candidate gathering
     * - Offer/answer exchange
     * - Stream negotiation
     */
    const peer = new Peer({
      initiator: initiator,                  // true = create offer, false = wait for offer
      stream: localStreamRef.current,       // Our local media stream to send
      trickle: true,                        // Allow incremental ICE updates
      config: {
        // STUN servers - help discover our public IP and NAT mapping
        // Using Google's public STUN servers
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      }
    });

    // Store peer connection for later reference
    peersRef.current.push({
      peerID: targetSocketId,
      peer: peer
    });

    // Update state to show connected peers
    setPeers(peersRef.current.map(p => p.peerID));

    /**
     * Signal Event Handler
     * 
     * Called when peer has signaling data to send to the other peer.
     * We forward this through the socket.io server.
     */
    peer.on('signal', signal => {
      console.log('📡 Signal from peer:', targetSocketId, signal.type);
      
      if (initiator && !offer) {
        // We're initiating - send an offer
        socketRef.current.emit('offer', {
          offer: signal,
          to: targetSocketId,
          from: socketRef.current.id
        });
      } else if (offer && signal.type === 'answer') {
        // We're responding - send an answer
        socketRef.current.emit('answer', {
          answer: signal,
          to: targetSocketId,
          from: socketRef.current.id
        });
      } else if (signal.type === 'candidate') {
        // Send ICE candidate
        socketRef.current.emit('ice-candidate', {
          candidate: signal,
          to: targetSocketId,
          from: socketRef.current.id
        });
      }
    });

    /**
     * Stream Event Handler
     * 
     * Called when we receive a stream from the remote peer.
     * This is the actual video/audio data we want to display.
     */
    peer.on('stream', stream => {
      console.log('🎥 Received stream from peer:', targetSocketId);
      
      // Create or get video element for this peer
      let videoElement = remoteVideosRef.current.get(targetSocketId);
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.id = `remote-video-${targetSocketId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;          // For mobile playback
        videoElement.className = "w-full h-full object-cover";
        remoteVideosRef.current.set(targetSocketId, videoElement);
      }
      
      // Attach the received stream to the video element
      videoElement.srcObject = stream;
      // Update state to trigger re-render
      setRemoteStreams(new Map(remoteVideosRef.current));
    });

    // Connection established
    peer.on('connect', () => {
      console.log('✅ Peer connection established with:', targetSocketId);
    });

    // Handle peer errors
    peer.on('error', err => {
      console.error('❌ Peer error with', targetSocketId, ':', err);
    });

    // Handle peer disconnection
    peer.on('close', () => {
      console.log('🔒 Peer connection closed with:', targetSocketId);
    });

    // If we received an offer, signal it to complete the handshake
    if (offer) {
      console.log('Signaling offer to peer');
      peer.signal(offer);
    }
  };

  /**
   * Toggle Audio
   * 
   * Enables or disables the local microphone.
   */
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;  // Toggle the enabled property
      });
      setIsAudioEnabled(!isAudioEnabled); // Update state
    }
  };

  /**
   * Toggle Video
   * 
   * Enables or disables the local camera.
   */
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  /**
   * Get Connection Status Color
   * 
   * Returns CSS color class based on connection status.
   */
  const getConnectionStatusColor = () => {
    switch(connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // ===== RENDER =====
  return (
    <div className="space-y-4">
      {/* Connection Status Bar */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Status indicator dot */}
            <div className={`h-3 w-3 rounded-full ${getConnectionStatusColor()}`}></div>
            
            {/* Status text */}
            <span className="text-sm font-medium text-gray-700">
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 'Error'}
            </span>
            
            {/* Room ID */}
            <span className="text-sm text-gray-600">
              Room: <span className="font-mono font-bold">{roomId}</span>
            </span>
            
            {/* User count */}
            <span className="text-sm text-gray-600">
              Users: <span className="font-bold">{peers.length + 1}</span>
            </span>
          </div>
          
          {/* Leave button */}
          <button
            onClick={onLeave}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition text-sm"
          >
            Leave Call
          </button>
        </div>
      </div>

      {/* Video Grid - Shows local and remote videos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Video - Your own video feed */}
        <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
          <video
            ref={localVideoRef}              // Connect to video element
            autoPlay                          // Auto-play when stream is available
            playsInline                        // Inline playback on mobile
            muted                              // Muted (so you don't hear yourself)
            className="w-full h-full object-cover"
          />
          {/* Label overlay */}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            You {!isVideoEnabled && '(Video Off)'} {!isAudioEnabled && '(Muted)'}
          </div>
        </div>

        {/* Remote Videos - Other participants */}
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

        {/* Placeholder when no one else is in the room */}
        {peers.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400 flex items-center justify-center min-h-[200px] aspect-video">
            <div>
              <p>Waiting for others to join...</p>
              <p className="text-sm text-gray-500 mt-2">Share this room ID: {roomId}</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex justify-center space-x-4">
          {/* Microphone toggle */}
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full ${
              isAudioEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'
            } text-white transition`}
          >
            {isAudioEnabled ? '🔊' : '🔇'}
          </button>

          {/* Camera toggle */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${
              isVideoEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'
            } text-white transition`}
          >
            {isVideoEnabled ? '📹' : '🚫'}
          </button>

          {/* AI Controls toggle */}
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

      {/* AI Control Panel Modal */}
      {showAIPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <AIControlPanel 
            serverUrl={aiServerUrl} 
            onClose={() => setShowAIPanel(false)} 
          />
        </div>
      )}

      {/* Debug Information (only shown in development) */}
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
