import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import AIControlPanel from './AIControlPanel';
import { replacePeerTrack } from '../utils/webrtc';

// ─── Config ───────────────────────────────────────────────────────────────────
// Derive AI server URL dynamically so any machine (laptop, ngrok, LAN) works.
const _proto      = window.location.protocol;
const _wsProto    = _proto === 'https:' ? 'wss:' : 'ws:';
const _host       = window.location.hostname;
const AI_HTTP_URL = process.env.REACT_APP_AI_HTTP_URL    || (_proto    + '//' + _host + ':8000');
const AI_SERVER_URL = process.env.REACT_APP_AI_SERVER_URL || (_wsProto + '//' + _host + ':8000');
const FRAME_INTERVAL = 50; // 20 fps

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
];

// ─── RemoteVideo ──────────────────────────────────────────────────────────────
const RemoteVideo = React.memo(({ stream, peerId, index }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
    return () => { video.srcObject = null; };
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="fade-in" style={{
      background: '#000', borderRadius: 12, overflow: 'hidden',
      position: 'relative', aspectRatio: '16/9',
      border: '1px solid var(--border)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <video ref={videoRef} autoPlay playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {/* Scan-line overlay */}
      <div className="scanline" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      {/* Label */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        color: '#fff', padding: '3px 10px', borderRadius: 6,
        fontSize: 11, fontFamily: 'var(--font-mono)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        PEER {String(index + 1).padStart(2, '0')} · {peerId?.substring(0, 8)}
      </div>
    </div>
  );
});

// ─── ControlButton ────────────────────────────────────────────────────────────
const ControlButton = ({ onClick, active, activeColor = 'var(--accent)', title, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 48, height: 48, borderRadius: '50%',
      background: active ? activeColor : 'var(--bg-raised)',
      border: '1px solid ' + (active ? activeColor : 'var(--border)'),
      color: '#fff', fontSize: 18, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s', flexShrink: 0,
      boxShadow: active ? `0 0 16px ${activeColor}66` : 'none',
    }}
    onMouseEnter={e => !active && (e.currentTarget.style.borderColor = 'var(--accent)')}
    onMouseLeave={e => !active && (e.currentTarget.style.borderColor = 'var(--border)')}
  >
    {children}
  </button>
);

// ─── VideoCall ────────────────────────────────────────────────────────────────
const VideoCall = ({ roomId, userId, onLeave, serverUrl }) => {
  const [peers, setPeers]                 = useState([]);
  const [remoteStreams, setRemoteStreams]  = useState(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [socketId, setSocketId]           = useState('');
  const [showAIPanel, setShowAIPanel]     = useState(false);

  // AI / face-swap state
  const [faceSwapEnabled, setFaceSwapEnabled] = useState(false);
  const [sourceSet, setSourceSet]             = useState(false);
  const [aiConnected, setAiConnected]         = useState(false);
  const [processedStream, setProcessedStream] = useState(null);

  // Refs
  const socketRef         = useRef(null);
  const peersRef          = useRef([]);
  const localVideoRef     = useRef(null);
  const localStreamRef    = useRef(null);
  const remoteStreamsRef  = useRef(new Map());
  const pendingOffersRef  = useRef([]);
  const pendingUsersRef   = useRef([]);
  const faceSwapWsRef     = useRef(null);
  const canvasRef         = useRef(null);
  const outputCanvasRef   = useRef(null);
  const frameTimerRef     = useRef(null);
  const faceSwapActiveRef = useRef(false);
  const aiConnectedRef    = useRef(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
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

  // ── AI Server check ────────────────────────────────────────────────────────
  const checkAiServer = useCallback(async () => {
    try {
      const res = await fetch(`${AI_HTTP_URL}/health`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: AbortSignal.timeout(3000),
      });
      await res.json();
      setAiConnected(true);
      aiConnectedRef.current = true;
    } catch {
      setAiConnected(false);
      aiConnectedRef.current = false;
    }
  }, []);

  // ── AI WebSocket ───────────────────────────────────────────────────────────
  const connectAiWebSocket = useCallback(() => {
    if (faceSwapWsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`${AI_SERVER_URL}/ws/face-swap`);
    faceSwapWsRef.current = ws;

    ws.onopen = () => { setAiConnected(true); aiConnectedRef.current = true; };
    ws.onmessage = (event) => {
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
    ws.onclose = () => { setAiConnected(false); aiConnectedRef.current = false; };
    ws.onerror = (e) => console.error('[AI WS]', e);
  }, []);

  // ── Frame capture ──────────────────────────────────────────────────────────
  const startFrameCapture = useCallback(() => {
    const video = localVideoRef.current;
    if (!video || !canvasRef.current || !outputCanvasRef.current) return;

    canvasRef.current.width = outputCanvasRef.current.width = 480;
    canvasRef.current.height = outputCanvasRef.current.height = 270;

    const outStream = outputCanvasRef.current.captureStream(20);
    localStreamRef.current?.getAudioTracks().forEach(t => outStream.addTrack(t));
    setProcessedStream(outStream);

    // Replace video track on all peers
    const newVideoTrack = outStream.getVideoTracks()[0];
    if (newVideoTrack) replacePeerTrack(peersRef.current, 'video', newVideoTrack);

    frameTimerRef.current = setInterval(() => {
      if (!faceSwapActiveRef.current) return;
      if (faceSwapWsRef.current?.readyState !== WebSocket.OPEN) return;
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
      faceSwapWsRef.current.send(JSON.stringify({ frame: canvasRef.current.toDataURL('image/jpeg', 0.7), userId }));
    }, FRAME_INTERVAL);
  }, [userId]);

  const stopFrameCapture = useCallback(() => {
    if (frameTimerRef.current) { clearInterval(frameTimerRef.current); frameTimerRef.current = null; }
    setProcessedStream(null);
    const origTrack = localStreamRef.current?.getVideoTracks()[0];
    if (origTrack) replacePeerTrack(peersRef.current, 'video', origTrack);
  }, []);

  // ── Toggle face swap ───────────────────────────────────────────────────────
  const handleToggleFaceSwap = useCallback(async () => {
    const next = !faceSwapEnabled;
    faceSwapActiveRef.current = next;
    setFaceSwapEnabled(next);

    try {
      await fetch(`${AI_HTTP_URL}/api/toggle-processing`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true', 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
    } catch (_) {}

    if (next) { connectAiWebSocket(); setTimeout(startFrameCapture, 500); }
    else       stopFrameCapture();
  }, [faceSwapEnabled, connectAiWebSocket, startFrameCapture, stopFrameCapture]);

  // ── Create peer ────────────────────────────────────────────────────────────
  const createPeer = useCallback((targetSocketId, initiator, offer = null) => {
    if (!localStreamRef.current) return;
    if (peersRef.current.find(p => p.peerID === targetSocketId)) return;

    const streamToSend = (faceSwapActiveRef.current && processedStream) ? processedStream : localStreamRef.current;

    const peer = new Peer({ initiator, stream: streamToSend, trickle: true, config: { iceServers: ICE_SERVERS } });
    peersRef.current.push({ peerID: targetSocketId, peer });
    syncPeers();

    peer.on('signal', (signal) => {
      const sock = socketRef.current;
      if (!sock) return;
      if (signal.type === 'offer')        sock.emit('offer',         { offer: signal,     to: targetSocketId, from: sock.id });
      else if (signal.type === 'answer')  sock.emit('answer',        { answer: signal,    to: targetSocketId, from: sock.id });
      else                                sock.emit('ice-candidate', { candidate: signal, to: targetSocketId, from: sock.id });
    });

    peer.on('stream', (stream) => {
      remoteStreamsRef.current.set(targetSocketId, stream);
      setRemoteStreams(prev => new Map(prev).set(targetSocketId, stream));
    });

    peer.on('iceConnectionStateChange', () => {
      if (peer._pc?.iceConnectionState === 'failed') { try { peer._pc.restartIce(); } catch (_) {} }
    });

    peer.on('error', (err) => console.error(`[Peer ${targetSocketId}]:`, err.message));

    if (offer) peer.signal(offer);
  }, [processedStream]);

  // ── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    checkAiServer();
    const aiPoll = setInterval(checkAiServer, 5000);

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
    });
    socketRef.current = socket;

    socket.on('connect', async () => {
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

        pendingUsersRef.current.forEach(sid => createPeer(sid, true));
        pendingUsersRef.current = [];

        pendingOffersRef.current.forEach(({ offer, from }) => {
          if (!peersRef.current.find(p => p.peerID === from)) createPeer(from, false, offer);
        });
        pendingOffersRef.current = [];
      } catch (err) {
        setConnectionStatus('error');
        alert(`Camera/mic access failed: ${err.message}`);
      }
    });

    socket.on('connect_error', (err) => { console.error(err.message); setConnectionStatus('error'); });
    socket.on('disconnect',    ()    => setConnectionStatus('connecting'));
    socket.on('reconnect',     ()    => setConnectionStatus('connected'));

    socket.on('user-connected',    ({ socketId: sid }) => {
      if (sid === socket.id) return;
      if (!localStreamRef.current) { pendingUsersRef.current.push(sid); return; }
      createPeer(sid, true);
    });
    socket.on('user-disconnected', ({ socketId: sid }) => removePeer(sid));

    socket.on('offer', ({ offer, from }) => {
      if (!localStreamRef.current) { pendingOffersRef.current.push({ offer, from }); return; }
      if (!peersRef.current.find(p => p.peerID === from)) createPeer(from, false, offer);
    });
    socket.on('answer',        ({ answer, from })    => { const e = peersRef.current.find(p => p.peerID === from); if (e) e.peer.signal(answer); });
    socket.on('ice-candidate', ({ candidate, from }) => { const e = peersRef.current.find(p => p.peerID === from); if (e && candidate) e.peer.signal(candidate); });
    socket.on('error',         ({ message })         => { if (['Room not found', 'Room is full'].includes(message)) { alert(message); onLeave(); } });

    return () => {
      clearInterval(aiPoll);
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      if (faceSwapWsRef.current) faceSwapWsRef.current.close();
      peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch (_) {} });
      peersRef.current = [];
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      socket.disconnect();
    };
  }, [roomId, userId, serverUrl, createPeer, removePeer, onLeave, checkAiServer]);

  // ── Media controls ─────────────────────────────────────────────────────────
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

  // ── Status indicator ───────────────────────────────────────────────────────
  const statusColor = connectionStatus === 'connected' ? 'var(--success)' : connectionStatus === 'connecting' ? 'var(--warn)' : 'var(--danger)';

  const totalParticipants = peers.length + 1;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
      {/* Hidden canvases */}
      <canvas ref={canvasRef}       style={{ display: 'none' }} />
      <canvas ref={outputCanvasRef} style={{ display: 'none' }} />

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px',
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block',
              ...(connectionStatus === 'connected' ? { animation: 'pulse-dot 1.8s ease-in-out infinite' } : {}),
            }} />
            <span style={{ color: 'var(--text-2)', fontSize: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {connectionStatus}
            </span>
          </div>
          <span style={{ color: 'var(--border)', fontSize: 10 }}>│</span>
          <span style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            ROOM&nbsp;<span style={{ color: 'var(--accent)' }}>{roomId}</span>
          </span>
          <span style={{ color: 'var(--border)', fontSize: 10 }}>│</span>
          <span style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            {totalParticipants} PARTICIPANT{totalParticipants !== 1 ? 'S' : ''}
          </span>
          {faceSwapEnabled && (
            <span style={{
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              color: '#c4b5fd', padding: '2px 10px', borderRadius: 999,
              fontSize: 11, fontFamily: 'var(--font-mono)',
            }}>🎭 FACE SWAP</span>
          )}
        </div>
        <button
          onClick={onLeave}
          style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', padding: '6px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
        >
          ✕ Leave
        </button>
      </div>

      {/* ── Video grid ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: remoteStreams.size === 0 ? '1fr 1fr' : `repeat(${Math.min(remoteStreams.size + 1, 3)}, 1fr)`,
        gap: 10,
      }}>
        {/* Local video */}
        <div style={{
          background: '#000', borderRadius: 12, overflow: 'hidden',
          position: 'relative', aspectRatio: '16/9',
          border: '1px solid var(--accent)',
          boxShadow: '0 0 20px var(--accent-glow)',
        }}>
          {faceSwapEnabled && processedStream ? (
            <video
              ref={el => { if (el && processedStream) { el.srcObject = processedStream; el.play().catch(() => {}); }}}
              autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <video ref={localVideoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          <div className="scanline" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            color: '#fff', padding: '3px 10px', borderRadius: 6,
            fontSize: 11, fontFamily: 'var(--font-mono)',
            border: '1px solid rgba(59,130,246,0.3)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse-dot 1.8s ease-in-out infinite' }} />
            YOU {faceSwapEnabled ? '· 🎭' : ''}
            {!isVideoEnabled ? ' · CAM OFF' : ''}
            {!isAudioEnabled ? ' · MUTED' : ''}
          </div>
        </div>

        {/* Remote peers */}
        {Array.from(remoteStreams.entries()).map(([sid, stream], i) => (
          <RemoteVideo key={sid} stream={stream} peerId={sid} index={i} />
        ))}

        {/* Waiting placeholders */}
        {remoteStreams.size === 0 && (
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, aspectRatio: '16/9',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '1px dashed var(--border)',
          }}>
            <div className="spinner" style={{ marginBottom: 14 }} />
            <p style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)', margin: 0 }}>
              WAITING FOR PEERS…
            </p>
            <p style={{ color: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)', margin: '4px 0 0', opacity: 0.5 }}>
              Share room ID: {roomId}
            </p>
          </div>
        )}
      </div>

      {/* ── Controls bar ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
        padding: '14px',
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
      }}>
        <ControlButton onClick={toggleAudio} active={!isAudioEnabled} activeColor="var(--danger)" title={isAudioEnabled ? 'Mute' : 'Unmute'}>
          {isAudioEnabled ? '🔊' : '🔇'}
        </ControlButton>

        <ControlButton onClick={toggleVideo} active={!isVideoEnabled} activeColor="var(--danger)" title={isVideoEnabled ? 'Stop Video' : 'Start Video'}>
          {isVideoEnabled ? '📹' : '🚫'}
        </ControlButton>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

        {/* Face swap quick toggle */}
        <button
          onClick={handleToggleFaceSwap}
          disabled={!sourceSet || !aiConnected}
          title="Toggle Face Swap"
          style={{
            height: 48, padding: '0 18px', borderRadius: 24,
            background: faceSwapEnabled ? 'rgba(139,92,246,0.2)' : 'var(--bg-raised)',
            border: '1px solid ' + (faceSwapEnabled ? 'rgba(139,92,246,0.5)' : 'var(--border)'),
            color: faceSwapEnabled ? '#c4b5fd' : (!sourceSet || !aiConnected ? 'var(--text-3)' : 'var(--text-1)'),
            fontSize: 13, fontFamily: 'var(--font-mono)', cursor: (!sourceSet || !aiConnected) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.2s',
            opacity: (!sourceSet || !aiConnected) ? 0.5 : 1,
          }}
        >
          🎭 {faceSwapEnabled ? 'ON' : 'OFF'}
        </button>

        {/* AI panel toggle */}
        <button
          onClick={() => setShowAIPanel(p => !p)}
          title="AI Controls"
          style={{
            height: 48, padding: '0 18px', borderRadius: 24,
            background: showAIPanel ? 'rgba(59,130,246,0.15)' : 'var(--bg-raised)',
            border: '1px solid ' + (showAIPanel ? 'rgba(59,130,246,0.4)' : 'var(--border)'),
            color: showAIPanel ? 'var(--accent)' : 'var(--text-2)',
            fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.2s',
          }}
        >
          ⚙ AI {aiConnected
            ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
          }
        </button>
      </div>

      {/* ── AI Panel (floating) ──────────────────────────────────────────────── */}
      {showAIPanel && (
        <div style={{ position: 'fixed', bottom: 100, right: 24, zIndex: 100 }}>
          <AIControlPanel
            serverUrl={serverUrl}
            onClose={() => setShowAIPanel(false)}
          />
        </div>
      )}

      {/* ── Dev debug panel ──────────────────────────────────────────────────── */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          background: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: '14px 16px',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4ade80',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px',
        }}>
          {[
            ['Socket', socketId?.substring(0,12) || '—'],
            ['Status', connectionStatus],
            ['Peers', peers.length],
            ['Streams', remoteStreams.size],
            ['AI', aiConnected ? '✅ online' : '❌ offline'],
            ['Face Swap', faceSwapEnabled ? '✅ active' : '⏹ off'],
            ['Source', sourceSet ? '✅ set' : '❌ not set'],
            ['Processed', processedStream ? '✅' : '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#64748b' }}>{k}:</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoCall;