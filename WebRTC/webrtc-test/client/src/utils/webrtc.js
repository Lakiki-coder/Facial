/**
 * webrtc.js — WebRTC Peer Connection Utility
 *
 * Wraps simple-peer to manage multi-peer WebRTC sessions.
 * Handles signaling integration with Socket.io, ICE restarts,
 * track replacement (for AI face-swap streams), and cleanup.
 */

import Peer from 'simple-peer';

// ─── ICE servers ─────────────────────────────────────────────────────────────
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// ─── PeerEntry ────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} PeerEntry
 * @property {string}  peerID   — remote socket ID
 * @property {Peer}    peer     — simple-peer instance
 */

// ─── createPeer ───────────────────────────────────────────────────────────────
/**
 * Create a new simple-peer connection.
 *
 * @param {Object}      opts
 * @param {string}      opts.targetSocketId   — remote peer's socket ID
 * @param {boolean}     opts.initiator        — true = we create the offer
 * @param {MediaStream} opts.stream           — local media stream to attach
 * @param {Object}      opts.socket           — Socket.io socket (for signaling)
 * @param {Function}    opts.onStream         — callback(socketId, stream)
 * @param {Function}    opts.onError          — callback(socketId, err)
 * @param {Object|null} [opts.offer]          — inbound offer (non-initiator only)
 *
 * @returns {Peer}
 */
export function createPeer({ targetSocketId, initiator, stream, socket, onStream, onError, offer = null }) {
  const peer = new Peer({
    initiator,
    stream,
    trickle: true,
    config: { iceServers: ICE_SERVERS },
  });

  // ── Signaling ──────────────────────────────────────────────────────────────
  peer.on('signal', (signal) => {
    if (!socket) return;
    if (signal.type === 'offer') {
      socket.emit('offer', { offer: signal, to: targetSocketId, from: socket.id });
    } else if (signal.type === 'answer') {
      socket.emit('answer', { answer: signal, to: targetSocketId, from: socket.id });
    } else {
      socket.emit('ice-candidate', { candidate: signal, to: targetSocketId, from: socket.id });
    }
  });

  // ── Remote stream ──────────────────────────────────────────────────────────
  peer.on('stream', (remoteStream) => {
    onStream?.(targetSocketId, remoteStream);
  });

  // ── ICE restart on failure ─────────────────────────────────────────────────
  peer.on('iceConnectionStateChange', () => {
    const state = peer._pc?.iceConnectionState;
    if (state === 'failed') {
      try { peer._pc.restartIce(); } catch (_) {}
    }
  });

  // ── Errors ─────────────────────────────────────────────────────────────────
  peer.on('error', (err) => {
    console.error(`[WebRTC] Peer error [${targetSocketId}]:`, err.message);
    onError?.(targetSocketId, err);
  });

  // Provide inbound offer to non-initiator
  if (offer) peer.signal(offer);

  return peer;
}

// ─── replacePeerTrack ─────────────────────────────────────────────────────────
/**
 * Replace a specific track kind ('video' | 'audio') across all peers.
 * Used when switching from raw camera to AI-processed canvas stream.
 *
 * @param {PeerEntry[]} peersRef   — array of { peerID, peer }
 * @param {'video'|'audio'} kind
 * @param {MediaStreamTrack} newTrack
 */
export function replacePeerTrack(peersRef, kind, newTrack) {
  peersRef.forEach(({ peer }) => {
    try {
      const senders = peer._pc?.getSenders?.() ?? [];
      const sender = senders.find((s) => s.track?.kind === kind);
      if (sender && newTrack) sender.replaceTrack(newTrack);
    } catch (e) {
      console.warn('[WebRTC] Could not replace track:', e);
    }
  });
}

// ─── destroyPeer ─────────────────────────────────────────────────────────────
/**
 * Safely destroy a peer connection.
 * @param {Peer} peer
 */
export function destroyPeer(peer) {
  try { peer.destroy(); } catch (_) {}
}

// ─── destroyAllPeers ─────────────────────────────────────────────────────────
/**
 * Destroy all peer connections in the list.
 * @param {PeerEntry[]} peers
 */
export function destroyAllPeers(peers) {
  peers.forEach(({ peer }) => destroyPeer(peer));
}

// ─── stopStream ──────────────────────────────────────────────────────────────
/**
 * Stop all tracks on a MediaStream.
 * @param {MediaStream|null} stream
 */
export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

// ─── getUserMedia ────────────────────────────────────────────────────────────
/**
 * Promisified getUserMedia with sensible defaults.
 * @param {MediaStreamConstraints} [constraints]
 * @returns {Promise<MediaStream>}
 */
export async function getUserMedia(constraints = { video: true, audio: true }) {
  return navigator.mediaDevices.getUserMedia(constraints);
}