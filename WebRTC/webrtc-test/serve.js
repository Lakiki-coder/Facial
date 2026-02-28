const express = require('express');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const PORT = 3001;
const BUILD_DIR = path.join(__dirname, 'client', 'build');

console.log('__dirname:', __dirname);
console.log('BUILD_DIR:', BUILD_DIR);

// Check if build directory exists
const fs = require('fs');
if (!fs.existsSync(BUILD_DIR)) {
  console.error('❌ Build directory not found:', BUILD_DIR);
} else {
  console.log('✅ Build directory found:', BUILD_DIR);
  console.log('Files:', fs.readdirSync(BUILD_DIR));
}

// ============ EXPRESS APP ============
const app = express();
app.use(express.json());
app.use(express.static(BUILD_DIR));

// Store active rooms and users
const rooms = new Map();
const users = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    users: users.size,
    timestamp: new Date().toISOString()
  });
});

// Create room endpoint
app.post('/api/rooms', (req, res) => {
  const roomId = uuidv4().substring(0, 8);
  rooms.set(roomId, {
    id: roomId,
    createdAt: new Date(),
    participants: [],
    maxParticipants: 10
  });
  console.log('✅ Room created:', roomId);
  res.json({ roomId });
});

// Validate room endpoint
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ 
    roomId,
    participants: room.participants.length,
    maxParticipants: room.maxParticipants
  });
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// Clean up empty rooms periodically
setInterval(() => {
  const now = new Date();
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.length === 0) {
      const roomAge = (now - new Date(room.createdAt)) / 1000 / 60;
      if (roomAge > 5) {
        rooms.delete(roomId);
        console.log(`🧹 Cleaned up empty room: ${roomId}`);
      }
    }
  }
}, 60000);

// ============ START SERVER ============
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌐 Access from other computers using your IP address`);
  console.log(`🔗 Use ngrok: ngrok http ${PORT}`);
});

// ============ SOCKET.IO SIGNALING ============
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log('🟢 Client connected:', socket.id);

  users.set(socket.id, {
    id: socket.id,
    roomId: null,
    userId: null,
    joinedAt: new Date()
  });

  socket.on('join-room', ({ roomId, userId }) => {
    let room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.participants.length >= room.maxParticipants) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    room.participants = room.participants.filter(p => p.userId !== userId);
    socket.join(roomId);
    
    const participant = { socketId: socket.id, userId, joinedAt: new Date() };
    room.participants.push(participant);
    
    const user = users.get(socket.id);
    if (user) { user.roomId = roomId; user.userId = userId; }

    console.log(`✅ User ${userId} joined room ${roomId}`);

    const otherParticipants = room.participants.filter(p => p.socketId !== socket.id);
    socket.emit('room-joined', {
      roomId,
      participants: otherParticipants,
      isHost: otherParticipants.length === 0
    });

    if (otherParticipants.length > 0) {
      socket.to(roomId).emit('user-connected', { userId, socketId: socket.id });
    }
  });

  socket.on('offer', ({ offer, to, from }) => {
    socket.to(to).emit('offer', { offer, from });
  });

  socket.on('answer', ({ answer, to, from }) => {
    socket.to(to).emit('answer', { answer, from });
  });

  socket.on('ice-candidate', ({ candidate, to, from }) => {
    socket.to(to).emit('ice-candidate', { candidate, from });
  });

  socket.on('leave-room', () => {
    const user = users.get(socket.id);
    if (user && user.roomId) {
      const room = rooms.get(user.roomId);
      if (room) {
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        socket.to(user.roomId).emit('user-disconnected', { socketId: socket.id, userId: user.userId });
      }
      socket.leave(user.roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
    const user = users.get(socket.id);
    if (user && user.roomId) {
      const room = rooms.get(user.roomId);
      if (room) {
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        socket.to(user.roomId).emit('user-disconnected', { socketId: socket.id, userId: user.userId });
      }
    }
    users.delete(socket.id);
  });
});
