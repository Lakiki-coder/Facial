/**
 * server.js — Express + Socket.io Signaling Server
 * 
 * This is the Node.js signaling server for WebRTC.
 * It coordinates peer connections and room management.
 * 
 * The Python AI server (server.py) runs separately on port 8000
 * and handles the actual face swap processing.
 * 
 * Run: node server.js
 * Or use serve.js which has the same logic (this file is the entry point)
 */

// Re-export everything from serve.js
// Your serve.js is already complete — just use that directly.
// Run: node serve.js

console.log('ℹ️  Use serve.js as your signaling server:');
console.log('   node serve.js');
console.log('');
console.log('   The AI face-swap backend is server.py (Python):');
console.log('   python server.py');