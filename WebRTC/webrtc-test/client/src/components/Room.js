import React, { useState } from 'react';

const Room = ({ onCreateRoom, onJoinRoom, error }) => {
  const [roomId, setRoomId]           = useState('');
  const [lastCreatedRoom, setLastCreatedRoom] = useState('');
  const [isCopied, setIsCopied]       = useState(false);
  const [isCreating, setIsCreating]   = useState(false);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const newRoomId = await onCreateRoom();
      setLastCreatedRoom(newRoomId);
      await navigator.clipboard.writeText(newRoomId).catch(() => {});
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error('Create room error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (roomId.trim()) onJoinRoom(e);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: '48px', animation: 'slide-up 0.5s ease forwards' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: '999px', padding: '6px 16px', marginBottom: '20px',
          fontSize: '12px', color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)'
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse-dot 1.8s ease-in-out infinite' }} />
          AI Video System v1.0
        </div>
        <h1 style={{
          fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 800, margin: 0,
          fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 1.1,
          color: 'var(--text-1)',
        }}>
          FACE<span style={{ color: 'var(--accent)' }}>CALL</span>
        </h1>
        <p style={{ color: 'var(--text-2)', marginTop: 10, fontSize: 15, maxWidth: 380, lineHeight: 1.6 }}>
          Real-time video calls with AI face &amp; voice transformation
        </p>
      </div>

      {/* ── Main card ───────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        animation: 'slide-up 0.5s 0.1s ease both',
      }}>
        {/* Top accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />

        <div style={{ padding: '32px' }}>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 20, padding: '12px 16px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, color: '#fca5a5', fontSize: 13, fontFamily: 'var(--font-mono)',
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Room created success */}
          {lastCreatedRoom && (
            <div style={{
              marginBottom: 24, padding: '16px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>✓ Room created</span>
                <button
                  onClick={() => copyToClipboard(lastCreatedRoom)}
                  style={{
                    background: isCopied ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)',
                    borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
                  }}
                >{isCopied ? '✓ Copied' : 'Copy'}</button>
              </div>
              <div style={{
                background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '10px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
                color: 'var(--success)', letterSpacing: '0.05em',
              }}>
                {lastCreatedRoom}
              </div>
              <p style={{ margin: '8px 0 0', color: 'var(--text-2)', fontSize: 11 }}>
                Share this ID — auto-copied to clipboard
              </p>
            </div>
          )}

          {/* Create Room */}
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            style={{
              width: '100%', padding: '14px', marginBottom: 20,
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: isCreating ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-display)', letterSpacing: '0.02em',
              opacity: isCreating ? 0.7 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
            }}
            onMouseEnter={e => { if (!isCreating) e.target.style.background = '#2563eb'; }}
            onMouseLeave={e => { e.target.style.background = 'var(--accent)'; }}
          >
            {isCreating ? '⏳ Creating…' : '+ Create New Room'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              or join existing
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Join form */}
          <form onSubmit={handleJoinSubmit}>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 12, marginBottom: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Room ID
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                id="roomId"
                name="roomId"
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                placeholder="e.g. a8869507"
                autoComplete="off"
                style={{
                  flex: 1, padding: '12px 14px',
                  background: 'var(--bg-deep)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-1)', fontSize: 15,
                  fontFamily: 'var(--font-mono)', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                required
              />
              {roomId && (
                <button
                  type="button"
                  onClick={() => setRoomId('')}
                  style={{
                    padding: '0 14px', background: 'var(--bg-raised)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    color: 'var(--text-3)', cursor: 'pointer', fontSize: 16,
                  }}
                >✕</button>
              )}
            </div>

            <button
              type="submit"
              disabled={!roomId.trim()}
              style={{
                width: '100%', padding: '13px', marginTop: 10,
                background: roomId.trim() ? 'var(--bg-raised)' : 'var(--bg-surface)',
                color: roomId.trim() ? 'var(--text-1)' : 'var(--text-3)',
                border: '1px solid ' + (roomId.trim() ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 10, fontSize: 15, fontWeight: 600,
                cursor: roomId.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-display)', transition: 'all 0.2s',
              }}
            >
              → Join Room
            </button>
          </form>
        </div>
      </div>

      {/* ── Quick tips ───────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 24, maxWidth: 440, width: '100%',
        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '20px 24px',
        animation: 'slide-up 0.5s 0.2s ease both',
      }}>
        <p style={{ margin: '0 0 12px', color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Quick start</p>
        {[
          ['01', 'Create a room and copy the ID'],
          ['02', 'Open a second tab or share with a friend'],
          ['03', 'Join with the same Room ID'],
          ['04', 'Allow camera & mic permissions'],
          ['05', 'Upload a face image to enable AI swap'],
        ].map(([n, txt]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, flexShrink: 0, marginTop: 1 }}>{n}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>{txt}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Room;