import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const AI_SERVER_URL = process.env.REACT_APP_AI_SERVER_URL || 'ws://localhost:8000';
const AI_HTTP_URL   = process.env.REACT_APP_AI_HTTP_URL   || 'http://localhost:8000';

// How many ms between frames sent to AI server (33ms ≈ 30fps, 66ms ≈ 15fps)
const FRAME_INTERVAL_MS = 50; // 20fps — good balance of quality vs latency

// ─────────────────────────────────────────────────────────────────────────────
// RemoteVideo
// ─────────────────────────────────────────────────────────────────────────────
const RemoteVideo = React.memo(({ stream, peerId }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    const p = video.play();
    if (p !== undefined) {
      p.catch(() => { video.muted = true; video.play().catch(() => {}); });
    }
    return () => { video.srcObject = null; };
  }, [stream, peerId]);

  if (!stream) return null;

  return (
    <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
        Peer {peerId?.substring(0, 8)}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FaceSwapControls
// ─────────────────────────────────────────────────────────────────────────────
const FaceSwapControls = ({ enabled, onToggle, onSourceUpload, sourceSet, aiConnected }) => {
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${AI_HTTP_URL}/api/source-face`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) onSourceUpload(true);
      else alert('Failed to upload source face: ' + data.message);
    } catch (err) {
      alert('Could not reach AI server. Is it running on port 8000?');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border-t-4 border-purple-500">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          🎭 Face Swap (Deep-Live-Cam)
          <span className={`text-xs px-2 py-0.5 rounded-full ${aiConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {aiConnected ? '● AI Connected' : '○ AI Offline'}
          </span>
        </h3>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {/* Upload Source Face */}
        <button
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium flex items-center gap-2"
        >
          🖼️ {sourceSet ? 'Change Source Face' : 'Upload Source Face'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {/* Status indicator */}
        {sourceSet && (
          <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
            ✅ Source face ready
          </span>
        )}

        {/* Toggle face swap */}
        <button
          onClick={onToggle}
          disabled={!sourceSet || !aiConnected}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            enabled
              ? 'bg-red-500 text-white hover:bg-red-600'
              : sourceSet && aiConnected
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {enabled ? '⏹ Stop Face Swap' : '▶ Start Face Swap'}
        </button>

        {!aiConnected && (
          <span className="text-xs text-red-500">
            Start Python server: <code className="bg-gray-100 px-1 rounded">python server.py</code>
          </span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VideoCall
// ─────────────────────────────────────────────────────────────────────────────
const VideoCall = ({ roomId, userId, onLeave, serverUrl }) => {
  const [peers, setPeers]                   = useState([]);
  const [remoteStreams, setRemoteStreams]    = useState(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [socketId, setSocketId]             = useState('');

  // ── Face Swap State ──────────────────────────────────────────────────────
  const [faceSwapEnabled, setFaceSwapEnabled]   = useState(false);
  const [sourceSet, setSourceSet]               = useState(false);
  const [aiConnected, setAiConnected]           = useState(false);
  const [processedStream, setProcessedStream]   = useState(null); // stream shown locally after AI

  // ── Refs ─────────────────────────────────────────────────────────────────
  const socketRef         = useRef(null);
  const peersRef          = useRef([]);
  const localVideoRef     = useRef(null);
  const processedVideoRef = useRef(null);    // preview of face-swapped local video
  const localStreamRef    = useRef(null);
  const remoteStreamsRef  = useRef(new Map());
  const pendingOffersRef  = useRef([]);
  const pendingUsersRef   = useRef([]);

  // Face swap refs
  const faceSwapWsRef     = useRef(null);     // WebSocket to AI server
  const canvasRef         = useRef(null);     // off-screen canvas for frame capture
  const outputCanvasRef   = useRef(null);     // canvas that becomes the processed stream
  const frameTimerRef     = useRef(null);     // setInterval handle
  const faceSwapActiveRef = useRef(false);    // ref mirror of faceSwapEnabled
  const aiConnectedRef    = useRef(false);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const syncPeers = () => setPeers(peersRef.current.map(p => p.peerID));

  const removePeer = useCallback((sid) => {
    const idx = peersRef.current.findIndex(p => p.peerID === sid);
    if (idx !== -1) {
      try { peersRef.current[idx].peer.destroy(); } catch (_) {}
      peersRef.current.splice(idx, 1);
    }
    remoteStreamsRef.current.delete(sid);
    setRemoteStreams(prev => { const n = new Map(prev); n.delete(sid); return n; });
    syncPeers();
  }, []);

  // ── AI Server connection check ────────────────────────────────────────────
  const checkAiServer = useCallback(async () => {
    try {
      const res = await fetch(`${AI_HTTP_URL}/health`, { signal: AbortSignal.timeout(2000) });
      const data = await res.json();
      setAiConnected(true);
      aiConnectedRef.current = true;
      return data;
    } catch {
      setAiConnected(false);
      aiConnectedRef.current = false;
      return null;
    }
  }, []);

  // ── Connect to AI WebSocket ───────────────────────────────────────────────
  const connectAiWebSocket = useCallback(() => {
    if (faceSwapWsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${AI_SERVER_URL}/ws/face-swap`);
    faceSwapWsRef.current = ws;

    ws.onopen = () => {
      console.log('🤖 AI WebSocket connected');
      setAiConnected(true);
      aiConnectedRef.current = true;
    };

    ws.onmessage = (event) => {
      // Receive processed frame and draw it to output canvas
      const data = JSON.parse(event.data);
      if (data.frame && outputCanvasRef.current) {
        const img = new Image();
        img.onload = () => {
          const ctx = outputCanvasRef.current?.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, outputCanvasRef.current.width, outputCanvasRef.current.height);
        };
        img.src = data.frame;
      }
    };

    ws.onclose = () => {
      console.log('🔴 AI WebSocket disconnected');
      setAiConnected(false);
      aiConnectedRef.current = false;
    };

    ws.onerror = (e) => console.error('AI WS error:', e);
  }, []);

  // ── Start sending frames to AI ────────────────────────────────────────────
  const startFrameCapture = useCallback(() => {
    const video = localVideoRef.current;
    if (!video || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width  = 480;
    canvas.height = 270;

    // Set up output canvas with same size
    if (outputCanvasRef.current) {
      outputCanvasRef.current.width  = 480;
      outputCanvasRef.current.height = 270;
    }

    // Capture output canvas as a MediaStream to send via WebRTC
    if (outputCanvasRef.current) {
      const outStream = outputCanvasRef.current.captureStream(20);
      // Merge with original audio
      const audioTracks = localStreamRef.current?.getAudioTracks() || [];
      audioTracks.forEach(t => outStream.addTrack(t));
      setProcessedStream(outStream);

      // Update all peers to use the processed stream
      peersRef.current.forEach(({ peer }) => {
        try {
          const senders = peer._pc?.getSenders?.() || [];
          senders.forEach(sender => {
            if (sender.track?.kind === 'video') {
              const newTrack = outStream.getVideoTracks()[0];
              if (newTrack) sender.replaceTrack(newTrack);
            }
          });
        } catch (e) {
          console.warn('Could not replace track:', e);
        }
      });
    }

    frameTimerRef.current = setInterval(() => {
      if (!faceSwapActiveRef.current) return;
      if (faceSwapWsRef.current?.readyState !== WebSocket.OPEN) return;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameData = canvas.toDataURL('image/jpeg', 0.7);

      faceSwapWsRef.current.send(JSON.stringify({
        frame: frameData,
        userId
      }));
    }, FRAME_INTERVAL_MS);
  }, [userId]);

  // ── Stop frame capture ────────────────────────────────────────────────────
  const stopFrameCapture = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    setProcessedStream(null);

    // Restore original stream tracks to peers
    peersRef.current.forEach(({ peer }) => {
      try {
        const senders = peer._pc?.getSenders?.() || [];
        senders.forEach(sender => {
          if (sender.track?.kind === 'video') {
            const origTrack = localStreamRef.current?.getVideoTracks()[0];
            if (origTrack) sender.replaceTrack(origTrack);
          }
        });
      } catch (e) {
        console.warn('Could not restore track:', e);
      }
    });
  }, []);

  // ── Toggle face swap ──────────────────────────────────────────────────────
  const handleToggleFaceSwap = useCallback(async () => {
    const next = !faceSwapEnabled;
    faceSwapActiveRef.current = next;
    setFaceSwapEnabled(next);

    try {
      await fetch(`${AI_HTTP_URL}/api/toggle-processing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      });
    } catch (e) {
      console.warn('Could not update AI server processing state');
    }

    if (next) {
      connectAiWebSocket();
      setTimeout(startFrameCapture, 500);
    } else {
      stopFrameCapture();
    }
  }, [faceSwapEnabled, connectAiWebSocket, startFrameCapture, stopFrameCapture]);

  // ── createPeer ────────────────────────────────────────────────────────────
  const createPeer = useCallback((targetSocketId, initiator, offer = null) => {
    if (!localStreamRef.current) return;
    if (peersRef.current.find(p => p.peerID === targetSocketId)) return;

    // Use processed stream if face swap is active, else raw stream
    const streamToSend = (faceSwapActiveRef.current && processedStream)
      ? processedStream
      : localStreamRef.current;

    const peer = new Peer({
      initiator,
      stream: streamToSend,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
        ]
      }
    });

    peersRef.current.push({ peerID: targetSocketId, peer });
    syncPeers();

    peer.on('signal', signal => {
      const sock = socketRef.current;
      if (!sock) return;
      if (signal.type === 'offer')         sock.emit('offer',         { offer: signal,     to: targetSocketId, from: sock.id });
      else if (signal.type === 'answer')   sock.emit('answer',        { answer: signal,    to: targetSocketId, from: sock.id });
      else                                 sock.emit('ice-candidate', { candidate: signal, to: targetSocketId, from: sock.id });
    });

    peer.on('stream', stream => {
      remoteStreamsRef.current.set(targetSocketId, stream);
      setRemoteStreams(prev => new Map(prev).set(targetSocketId, stream));
    });

    peer.on('iceConnectionStateChange', () => {
      const state = peer._pc?.iceConnectionState;
      if (state === 'failed') { try { peer._pc.restartIce(); } catch (_) {} }
    });

    peer.on('error', err => console.error(`Peer error [${targetSocketId}]:`, err.message));

    if (offer) peer.signal(offer);
  }, [processedStream]);

  // ── Main effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Check AI server on mount
    checkAiServer();
    const aiPoll = setInterval(checkAiServer, 5000);

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true
    });
    socketRef.current = socket;

    socket.on('connect', async () => {
      console.log('✅ Socket connected:', socket.id);
      setSocketId(socket.id);
      setConnectionStatus('connected');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        socket.emit('join-room', { roomId, userId });

        // Flush pending users
        pendingUsersRef.current.forEach(sid => createPeer(sid, true));
        pendingUsersRef.current = [];

        // Flush pending offers
        pendingOffersRef.current.forEach(({ offer, from }) => {
          if (!peersRef.current.find(p => p.peerID === from)) createPeer(from, false, offer);
        });
        pendingOffersRef.current = [];
      } catch (err) {
        setConnectionStatus('error');
        alert(`Camera/mic access failed: ${err.message}`);
      }
    });

    socket.on('connect_error', err => { console.error('Socket error:', err.message); setConnectionStatus('error'); });
    socket.on('disconnect',    ()    => setConnectionStatus('connecting'));
    socket.on('reconnect',     ()    => setConnectionStatus('connected'));

    socket.on('room-joined', ({ participants }) => {
      console.log('🏠 room-joined | participants:', participants);
    });

    socket.on('user-connected', ({ socketId: newSid }) => {
      if (newSid === socket.id) return;
      if (!localStreamRef.current) { pendingUsersRef.current.push(newSid); return; }
      createPeer(newSid, true);
    });

    socket.on('user-disconnected', ({ socketId: sid }) => removePeer(sid));

    socket.on('offer', ({ offer, from }) => {
      if (!localStreamRef.current) { pendingOffersRef.current.push({ offer, from }); return; }
      if (!peersRef.current.find(p => p.peerID === from)) createPeer(from, false, offer);
    });

    socket.on('answer',        ({ answer, from })    => { const e = peersRef.current.find(p => p.peerID === from); if (e) e.peer.signal(answer); });
    socket.on('ice-candidate', ({ candidate, from }) => { const e = peersRef.current.find(p => p.peerID === from); if (e && candidate) e.peer.signal(candidate); });
    socket.on('error',         ({ message })         => { if (message === 'Room not found' || message === 'Room is full') { alert(message); onLeave(); } });

    return () => {
      clearInterval(aiPoll);
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      if (faceSwapWsRef.current) faceSwapWsRef.current.close();
      peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch (_) {} });
      peersRef.current = [];
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
      socket.disconnect();
    };
  }, [roomId, userId, serverUrl, createPeer, removePeer, onLeave, checkAiServer]);

  // ── Media controls ────────────────────────────────────────────────────────
  const toggleAudio = () => {
    const next = !isAudioEnabled;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    setIsAudioEnabled(next);
  };

  const toggleVideo = () => {
    const next = !isVideoEnabled;
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
    setIsVideoEnabled(next);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Hidden canvases for frame processing */}
      <canvas ref={canvasRef}       style={{ display: 'none' }} />
      <canvas ref={outputCanvasRef} style={{ display: 'none' }} />

      {/* Status bar */}
      <div className="bg-white rounded-lg shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className={`h-3 w-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium capitalize">{connectionStatus}</span>
          <span className="text-sm text-gray-500">Room: {roomId}</span>
          <span className="text-sm text-gray-500">Users: {peers.length + 1}</span>
          {faceSwapEnabled && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">🎭 Face Swap ON</span>}
        </div>
        <button onClick={onLeave} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 text-sm">
          Leave Call
        </button>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local video — shows processed if face swap is on */}
        <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
          {faceSwapEnabled && processedStream ? (
            <video
              ref={el => { if (el && processedStream) { el.srcObject = processedStream; el.play().catch(() => {}); } }}
              autoPlay playsInline muted
              className="w-full h-full object-cover"
            />
          ) : (
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          )}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            You {faceSwapEnabled ? '🎭' : ''}{!isVideoEnabled ? ' (Video Off)' : ''}{!isAudioEnabled ? ' 🔇' : ''}
          </div>
        </div>

        {/* Remote streams */}
        {Array.from(remoteStreams.entries()).map(([sid, stream]) => (
          <RemoteVideo key={sid} stream={stream} peerId={sid} />
        ))}

        {remoteStreams.size === 0 && peers.length > 0 && (
          <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center text-gray-400">
            <p className="animate-pulse text-sm">⏳ Peer connected — waiting for video…</p>
          </div>
        )}

        {peers.length === 0 && (
          <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-sm">Waiting for others to join…</p>
              <p className="text-xs mt-1 opacity-60">Room: {roomId}</p>
            </div>
          </div>
        )}
      </div>

      {/* Media controls */}
      <div className="bg-white rounded-lg shadow-md p-4 flex justify-center space-x-4">
        <button onClick={toggleAudio} title={isAudioEnabled ? 'Mute' : 'Unmute'}
          className={`p-3 rounded-full text-white transition-colors ${isAudioEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}>
          {isAudioEnabled ? '🔊' : '🔇'}
        </button>
        <button onClick={toggleVideo} title={isVideoEnabled ? 'Stop video' : 'Start video'}
          className={`p-3 rounded-full text-white transition-colors ${isVideoEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}>
          {isVideoEnabled ? '📹' : '🚫'}
        </button>
      </div>

      {/* Face Swap Controls */}
      <FaceSwapControls
        enabled={faceSwapEnabled}
        onToggle={handleToggleFaceSwap}
        onSourceUpload={setSourceSet}
        sourceSet={sourceSet}
        aiConnected={aiConnected}
      />

      {/* Debug panel */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono space-y-1">
          <div>Socket    : {socketId?.substring(0,12) || '—'}</div>
          <div>Status    : {connectionStatus}</div>
          <div>Peers     : {peers.length}</div>
          <div>Streams   : {remoteStreams.size}</div>
          <div>AI Server : {aiConnected ? '✅ connected' : '❌ offline'}</div>
          <div>Face Swap : {faceSwapEnabled ? '✅ active' : '⏹ off'}</div>
          <div>Source    : {sourceSet ? '✅ set' : '❌ not set'}</div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;