import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

// ─────────────────────────────────────────────────────────────────────────────
// RemoteVideo – isolated component so stream changes don't re-render parent
// ─────────────────────────────────────────────────────────────────────────────
const RemoteVideo = React.memo(({ stream, peerId }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    console.log(`🎬 RemoteVideo: attaching stream for ${peerId?.substring(0, 8)}`);
    video.srcObject = stream;

    // Some browsers need an explicit play() after srcObject assignment
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        // Autoplay blocked – unmute and retry (works in most browsers)
        video.muted = true;
        video.play().catch(err => console.warn('Play retry failed:', err));
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream, peerId]);

  if (!stream) return null;

  return (
    <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Do NOT set muted here – that silences the remote participant permanently.
        // We handle muting only as an autoplay fallback in the effect above.
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
        Peer {peerId?.substring(0, 8)}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// VideoCall
// ─────────────────────────────────────────────────────────────────────────────
const VideoCall = ({ roomId, userId, onLeave, serverUrl }) => {
  const [peers, setPeers] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [socketId, setSocketId] = useState('');

  // ── Refs (never stale inside callbacks) ────────────────────────────────────
  const socketRef        = useRef(null);
  const peersRef         = useRef([]);          // [{ peerID, peer }]
  const localVideoRef    = useRef(null);
  const localStreamRef   = useRef(null);         // FIX 3: track stream via ref
  const remoteStreamsRef = useRef(new Map());    // FIX 2: ref mirror of state
  const pendingOffersRef = useRef([]);
  const pendingUsersRef  = useRef([]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const syncPeers = () => setPeers(peersRef.current.map(p => p.peerID));

  const removePeer = useCallback((socketId) => {
    const idx = peersRef.current.findIndex(p => p.peerID === socketId);
    if (idx !== -1) {
      try { peersRef.current[idx].peer.destroy(); } catch (_) {}
      peersRef.current.splice(idx, 1);
    }
    remoteStreamsRef.current.delete(socketId);
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
    syncPeers();
  }, []);

  // ── createPeer ─────────────────────────────────────────────────────────────
  // FIX 1: NO dependency on `remoteStreams` state – use refs only.
  // This means createPeer's reference never changes → useEffect won't re-run.
  const createPeer = useCallback((targetSocketId, initiator, offer = null) => {
    if (!localStreamRef.current) {
      console.warn('⏳ createPeer called but no local stream yet');
      return;
    }

    // Avoid duplicate peers
    if (peersRef.current.find(p => p.peerID === targetSocketId)) {
      console.log(`ℹ️ Peer already exists for ${targetSocketId}`);
      return;
    }

    console.log(`🔧 Creating peer → ${targetSocketId} | initiator: ${initiator}`);

    const peer = new Peer({
      initiator,
      stream: localStreamRef.current,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    peersRef.current.push({ peerID: targetSocketId, peer });
    syncPeers();

    // ── Signaling ────────────────────────────────────────────────────────────
    peer.on('signal', signal => {
      const sock = socketRef.current;
      if (!sock) return;
      console.log(`📡 Signal out → ${targetSocketId} type: ${signal.type || 'candidate'}`);

      if (signal.type === 'offer') {
        sock.emit('offer', { offer: signal, to: targetSocketId, from: sock.id });
      } else if (signal.type === 'answer') {
        sock.emit('answer', { answer: signal, to: targetSocketId, from: sock.id });
      } else {
        // ICE candidate (trickle)
        sock.emit('ice-candidate', { candidate: signal, to: targetSocketId, from: sock.id });
      }
    });

    // ── Stream received ───────────────────────────────────────────────────────
    peer.on('stream', stream => {
      console.log(`🎥✅ GOT STREAM from ${targetSocketId}`);
      console.log(`   tracks: ${stream.getTracks().length} | video: ${stream.getVideoTracks().length} | audio: ${stream.getAudioTracks().length}`);

      // FIX 2: update the ref first (no stale closure), then update state
      remoteStreamsRef.current.set(targetSocketId, stream);
      setRemoteStreams(prev => new Map(prev).set(targetSocketId, stream));
    });

    // ── ICE / Connection state ────────────────────────────────────────────────
    peer.on('iceConnectionStateChange', () => {
      const state = peer._pc?.iceConnectionState;
      console.log(`🔌 ICE state [${targetSocketId.substring(0,8)}]: ${state}`);

      if (state === 'failed') {
        console.warn(`⚠️ ICE failed for ${targetSocketId} – attempting restart`);
        try { peer._pc.restartIce(); } catch (e) { console.error('restartIce failed:', e); }
      }

      // FIX 2: use ref, not stale state
      if (state === 'connected' && !remoteStreamsRef.current.has(targetSocketId)) {
        console.warn(`⚠️ ICE connected but no stream yet from ${targetSocketId}`);
      }
    });

    peer.on('connect',   ()    => console.log(`✅ Data channel open: ${targetSocketId}`));
    peer.on('error',     (err) => console.error(`❌ Peer error [${targetSocketId}]:`, err.message));
    peer.on('close',     ()    => console.log(`🔒 Peer closed: ${targetSocketId}`));

    // Signal the offer if we're the responder
    if (offer) {
      console.log(`📨 Signalling received offer to peer: ${targetSocketId}`);
      peer.signal(offer);
    }
  }, []); // ← FIX 1: empty deps — only touches refs, never state

  // ── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log(`🎬 VideoCall mount | room: ${roomId} | user: ${userId}`);

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true
    });
    socketRef.current = socket;

    // ── Socket lifecycle ──────────────────────────────────────────────────────
    socket.on('connect', async () => {
      console.log('✅ Socket connected:', socket.id);
      setSocketId(socket.id);
      setConnectionStatus('connected');

      try {
        console.log('📷 Requesting camera/mic...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true
        });

        console.log(`✅ Local stream ready | video: ${stream.getVideoTracks().length} | audio: ${stream.getAudioTracks().length}`);
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Drain pending queues now that we have a stream
        if (pendingUsersRef.current.length > 0) {
          console.log('👥 Processing pending users:', pendingUsersRef.current);
          pendingUsersRef.current.forEach(sid => {
            if (sid !== socket.id) createPeer(sid, true);
          });
          pendingUsersRef.current = [];
        }

        if (pendingOffersRef.current.length > 0) {
          console.log('📋 Processing pending offers:', pendingOffersRef.current.length);
          pendingOffersRef.current.forEach(({ offer, from }) => createPeer(from, false, offer));
          pendingOffersRef.current = [];
        }

        console.log('🚪 Joining room:', roomId);
        socket.emit('join-room', { roomId, userId });

      } catch (err) {
        console.error('❌ getUserMedia failed:', err);
        setConnectionStatus('error');
        alert(`Camera/mic access failed: ${err.message}`);
      }
    });

    socket.on('connect_error', err => {
      console.error('❌ Socket connect error:', err.message);
      setConnectionStatus('error');
    });

    socket.on('disconnect', reason => {
      console.log('Socket disconnected:', reason);
      setConnectionStatus('connecting');
    });

    socket.on('reconnect', () => {
      console.log('Socket reconnected');
      setConnectionStatus('connected');
    });

    // ── Room events ───────────────────────────────────────────────────────────
    socket.on('room-joined', ({ participants }) => {
      console.log('🏠 room-joined | participants:', participants);
      // We are the NEW joiner — existing users will send us offers.
      // Nothing to initiate here; just wait.
    });

    socket.on('user-connected', ({ socketId: newSocketId }) => {
      console.log('👤 user-connected:', newSocketId);
      if (newSocketId === socket.id) return;

      if (!localStreamRef.current) {
        pendingUsersRef.current.push(newSocketId);
        return;
      }
      // We are EXISTING — initiate connection to new joiner
      createPeer(newSocketId, true);
    });

    socket.on('user-disconnected', ({ socketId: disconnectedId }) => {
      console.log('👋 user-disconnected:', disconnectedId);
      removePeer(disconnectedId);
    });

    // ── WebRTC signaling ──────────────────────────────────────────────────────
    socket.on('offer', ({ offer, from }) => {
      console.log('📞 Received offer from:', from);
      if (!localStreamRef.current) {
        pendingOffersRef.current.push({ offer, from });
        return;
      }
      if (!peersRef.current.find(p => p.peerID === from)) {
        createPeer(from, false, offer);
      }
    });

    socket.on('answer', ({ answer, from }) => {
      console.log('📞 Received answer from:', from);
      const entry = peersRef.current.find(p => p.peerID === from);
      if (entry) entry.peer.signal(answer);
      else console.warn(`⚠️ answer: no peer found for ${from}`);
    });

    socket.on('ice-candidate', ({ candidate, from }) => {
      const entry = peersRef.current.find(p => p.peerID === from);
      if (entry && candidate) entry.peer.signal(candidate);
    });

    socket.on('error', ({ message }) => {
      console.error('Room error:', message);
      if (message === 'Room not found' || message === 'Room is full') {
        alert(message);
        onLeave();
      }
    });

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      console.log('🧹 Cleaning up VideoCall');
      peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch (_) {} });
      peersRef.current = [];

      // FIX 3: stop tracks from ref, not stale state variable
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }

      socket.disconnect();
    };
  // FIX 1: createPeer has stable reference now (empty deps), safe to include
  }, [roomId, userId, serverUrl, createPeer, removePeer, onLeave]);

  // ── Media controls ─────────────────────────────────────────────────────────
  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isAudioEnabled;
    stream.getAudioTracks().forEach(t => { t.enabled = next; });
    setIsAudioEnabled(next);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isVideoEnabled;
    stream.getVideoTracks().forEach(t => { t.enabled = next; });
    setIsVideoEnabled(next);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="bg-white rounded-lg shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className={`h-3 w-3 rounded-full ${
            connectionStatus === 'connected'  ? 'bg-green-500'  :
            connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="text-sm font-medium capitalize">{connectionStatus}</span>
          <span className="text-sm text-gray-500">Room: {roomId}</span>
          <span className="text-sm text-gray-500">Users: {peers.length + 1}</span>
        </div>
        <button onClick={onLeave} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
          Leave Call
        </button>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local */}
        <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            You{!isVideoEnabled ? ' (Video Off)' : ''}{!isAudioEnabled ? ' (Muted)' : ''}
          </div>
        </div>

        {/* Remote streams */}
        {Array.from(remoteStreams.entries()).map(([sid, stream]) => (
          <RemoteVideo key={sid} stream={stream} peerId={sid} />
        ))}

        {/* Peer connected but stream not yet received */}
        {remoteStreams.size === 0 && peers.length > 0 && (
          <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="animate-pulse">⏳ Peer connected — waiting for video…</p>
              <p className="text-xs mt-2 opacity-60">Check console for ICE state</p>
            </div>
          </div>
        )}

        {/* No peers yet */}
        {peers.length === 0 && (
          <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p>Waiting for others to join…</p>
              <p className="text-xs mt-2 opacity-60">Room: {roomId}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 flex justify-center space-x-4">
        <button
          onClick={toggleAudio}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
          className={`p-3 rounded-full text-white transition-colors ${isAudioEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}
        >
          {isAudioEnabled ? '🔊' : '🔇'}
        </button>
        <button
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Stop video' : 'Start video'}
          className={`p-3 rounded-full text-white transition-colors ${isVideoEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}
        >
          {isVideoEnabled ? '📹' : '🚫'}
        </button>
      </div>

      {/* Debug panel (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono space-y-1">
          <div>Socket ID : {socketId || '—'}</div>
          <div>Status    : {connectionStatus}</div>
          <div>Peers     : {peers.length}</div>
          <div>Streams   : {remoteStreams.size}</div>
          <div>Local     : {localStreamRef.current ? '✅' : '❌'}</div>
          {peers.map(pid => (
            <div key={pid}>
              Peer {pid.substring(0,8)} stream: {remoteStreams.has(pid) ? '✅' : '⏳'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoCall;