import React, { useState, useEffect, useRef } from 'react';
import { aiClient } from '../utils/aiProcessing';

const Toggle = ({ on, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`toggle-track ${on ? 'on' : 'off'} ${disabled ? 'disabled' : ''}`}
    style={{ border: 'none', padding: 0 }}
    aria-label="Toggle"
  >
    <span className="toggle-thumb" />
  </button>
);

const Stat = ({ label, value, unit = '' }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{label}</span>
    <span style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
      {value}{unit}
    </span>
  </div>
);

const AIControlPanel = ({ serverUrl, onClose }) => {
  const [isConnected, setIsConnected]           = useState(false);
  const [faceSwapEnabled, setFaceSwapEnabled]   = useState(false);
  const [voiceConvertEnabled, setVoiceConvertEnabled] = useState(false);
  const [selectedFace, setSelectedFace]         = useState(null);
  const [status, setStatus]                     = useState(null);
  const [isLoading, setIsLoading]               = useState(false);
  const [latency, setLatency]                   = useState(0);
  const [fps, setFps]                           = useState(0);

  const fileInputRef   = useRef(null);
  const pingIntervalRef = useRef(null);

  useEffect(() => {
    connectToAI();

    aiClient.on('connected',     () => setIsConnected(true));
    aiClient.on('disconnected',  () => setIsConnected(false));
    aiClient.on('frameProcessed', (msg) => {
      setLatency(msg.latency || 0);
      setFps(msg.fps || 0);
    });

    pingIntervalRef.current = setInterval(() => aiClient.ping(), 10_000);
    fetchStatus();

    return () => { clearInterval(pingIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectToAI = async () => {
    try {
      // Build AI backend URL using same hostname, port 8080 (Spring Boot)
      const proto = window.location.protocol;
      const host  = window.location.hostname;
      const aiUrl = proto + '//' + host + ':8080';
      await aiClient.connect(aiUrl);
    } catch (e) {
      console.warn('[AIPanel] Could not connect to AI server:', e);
    }
  };

  const fetchStatus = async () => {
    try { setStatus(await aiClient.getStatus()); } catch (_) {}
  };

  const handleFaceSwapToggle = async () => {
    if (isLoading || !selectedFace) return;
    const next = !faceSwapEnabled;
    setIsLoading(true);
    try {
      await aiClient.setFaceSwapEnabled(next);
      setFaceSwapEnabled(next);
      aiClient.configure(next, voiceConvertEnabled);
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const handleVoiceConvertToggle = async () => {
    if (isLoading) return;
    const next = !voiceConvertEnabled;
    setIsLoading(true);
    try {
      await aiClient.setVoiceConvertEnabled(next);
      setVoiceConvertEnabled(next);
      aiClient.configure(faceSwapEnabled, next);
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const handleFaceImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imageData = e.target.result.split(',')[1];
        await aiClient.loadFace(imageData, file.name);
        setSelectedFace(file.name);
        setFaceSwapEnabled(true);
        aiClient.configure(true, voiceConvertEnabled);
      } catch (err) { console.error('[AIPanel] Face load error:', err); }
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const S = {
    panel: {
      width: 300,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      animation: 'slide-up 0.3s ease forwards',
    },
    topBar: {
      height: 3,
      background: 'linear-gradient(90deg, var(--accent-2), var(--accent))',
    },
    body: { padding: '18px' },
    section: {
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px',
      marginBottom: 10,
    },
    label: {
      color: 'var(--text-1)', fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 6,
    },
    subLabel: {
      color: 'var(--text-3)', fontSize: 11,
      fontFamily: 'var(--font-mono)', marginTop: 2,
    },
    uploadBtn: {
      width: '100%', marginTop: 10, padding: '8px 12px',
      background: 'rgba(139,92,246,0.12)',
      border: '1px solid rgba(139,92,246,0.3)',
      borderRadius: 8, color: '#c4b5fd',
      fontSize: 12, fontFamily: 'var(--font-mono)',
      cursor: 'pointer', transition: 'all 0.2s',
    },
    refreshBtn: {
      width: '100%', marginTop: 12, padding: '9px',
      background: 'var(--bg-raised)', border: '1px solid var(--border)',
      borderRadius: 8, color: 'var(--text-2)', fontSize: 12,
      fontFamily: 'var(--font-mono)', cursor: 'pointer',
      transition: 'all 0.2s',
    },
  };

  return (
    <div style={S.panel}>
      <div style={S.topBar} />
      <div style={S.body}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.04em' }}>
              AI CONTROLS
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isConnected ? 'var(--success)' : 'var(--danger)',
                display: 'inline-block',
                ...(isConnected ? { animation: 'pulse-dot 1.8s ease-in-out infinite' } : {}),
              }} />
              <span style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                {isConnected ? 'AI Backend Online' : 'AI Backend Offline'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '4px 10px', color: 'var(--text-3)',
              cursor: 'pointer', fontSize: 14, transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--text-1)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-3)'}
          >✕</button>
        </div>

        {/* Face Swap */}
        <div style={S.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={S.label}>🎭 Face Swap</div>
              <div style={S.subLabel}>Deep-Live-Cam</div>
            </div>
            <Toggle on={faceSwapEnabled} onClick={handleFaceSwapToggle} disabled={isLoading || !selectedFace} />
          </div>

          <input
            type="file" ref={fileInputRef}
            onChange={handleFaceImageSelect}
            accept="image/*" style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            style={S.uploadBtn}
            onMouseEnter={e => e.target.style.background = 'rgba(139,92,246,0.2)'}
            onMouseLeave={e => e.target.style.background = 'rgba(139,92,246,0.12)'}
          >
            {selectedFace
              ? `✓ ${selectedFace.length > 20 ? selectedFace.slice(0,20)+'…' : selectedFace}`
              : '↑ Upload source face'}
          </button>
        </div>

        {/* Voice Conversion */}
        <div style={S.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={S.label}>🎙 Voice Convert</div>
              <div style={S.subLabel}>RVC Model</div>
            </div>
            <Toggle on={voiceConvertEnabled} onClick={handleVoiceConvertToggle} disabled={isLoading} />
          </div>
          {voiceConvertEnabled && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              Requires RVC server on :8000
            </div>
          )}
        </div>

        {/* Performance stats */}
        <div style={{ ...S.section, background: 'rgba(0,0,0,0.4)' }}>
          <p style={{ margin: '0 0 8px', color: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Performance
          </p>
          <Stat label="Latency" value={latency} unit="ms" />
          <Stat label="FPS" value={fps.toFixed(1)} />
          <Stat label="Status" value={status?.status || '—'} />
        </div>

        {/* Refresh */}
        <button
          onClick={fetchStatus}
          style={S.refreshBtn}
          onMouseEnter={e => e.target.style.color = 'var(--text-1)'}
          onMouseLeave={e => e.target.style.color = 'var(--text-2)'}
        >
          ↻ Refresh Status
        </button>
      </div>
    </div>
  );
};

export default AIControlPanel;