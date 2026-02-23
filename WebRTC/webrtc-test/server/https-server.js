const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Load SSL certificates (adjust path as needed)
const certPath = path.join(__dirname, '..');
const options = {
  key: fs.readFileSync(path.join(certPath, '172.16.0.125+2-key.pem')),
  cert: fs.readFileSync(path.join(certPath, '172.16.0.125+2.pem'))
};

// Store active rooms and users
const rooms = new Map();
const users = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  const roomsList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    participants: room.participants.length,
    createdAt: room.createdAt
  }));
  
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    roomsList: roomsList,
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

// Clean up empty rooms periodically
setInterval(() => {
  const now = new Date();
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.length === 0) {
      const roomAge = (now - new Date(room.createdAt)) / 1000 / 60;
      if (roomAge > 5) {
        rooms.delete(roomId);
        console.log(`🧹 Cleaned up empty room: ${roomId} (${roomAge.toFixed(1)} minutes old)`);
      }
    }
  }
}, 60000);

// Create HTTPS server
const server = https.createServer(options, app);

// Socket.io with HTTPS support
const io = new Server(server, {
  cors: {
    origin: ["https://172.16.0.125:3000", "https://localhost:3000", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🟢 New client connected:', socket.id);
  console.log('Current rooms:', Array.from(rooms.keys()));

  // Store user info
  users.set(socket.id, {
    id: socket.id,
    roomId: null,
    userId: null,
    joinedAt: new Date()
  });

  // Join room
  socket.on('join-room', ({ roomId, userId }) => {
    console.log(`📥 Join room request: ${roomId} from user ${userId} (socket: ${socket.id})`);
    
    let room = rooms.get(roomId);
    
    if (!room) {
      console.log(`❌ Room not found: ${roomId}`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.participants.length >= room.maxParticipants) {
      console.log(`❌ Room is full: ${roomId}`);
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Remove any existing participant with same userId
    room.participants = room.participants.filter(p => p.userId !== userId);

    // Join socket.io room
    socket.join(roomId);
    
    // Add new participant
    const participant = { 
      socketId: socket.id, 
      userId,
      joinedAt: new Date()
    };
    room.participants.push(participant);
    
    // Update user's room
    const user = users.get(socket.id);
    if (user) {
      user.roomId = roomId;
      user.userId = userId;
    }

    console.log(`✅ User ${userId} joined room ${roomId}`);
    console.log(`Room ${roomId} now has ${room.participants.length} participants`);

    // Send current participants to the new user
    const otherParticipants = room.participants.filter(p => p.socketId !== socket.id);
    socket.emit('room-joined', {
      roomId,
      participants: otherParticipants,
      isHost: otherParticipants.length === 0
    });

    // Notify others
    if (otherParticipants.length > 0) {
      socket.to(roomId).emit('user-connected', {
        userId,
        socketId: socket.id
      });
    }
  });

  // WebRTC signaling events
  socket.on('offer', ({ offer, to, from }) => {
    console.log(`📤 Forwarding offer from ${from} to ${to}`);
    socket.to(to).emit('offer', { offer, from });
  });

  socket.on('answer', ({ answer, to, from }) => {
    console.log(`📤 Forwarding answer from ${from} to ${to}`);
    socket.to(to).emit('answer', { answer, from });
  });

  socket.on('ice-candidate', ({ candidate, to, from }) => {
    console.log(`📤 Forwarding ICE candidate from ${from} to ${to}`);
    socket.to(to).emit('ice-candidate', { candidate, from });
  });

  socket.on('renegotiate', ({ to, from }) => {
    socket.to(to).emit('renegotiate', { from });
  });

  socket.on('leave-room', () => {
    handleUserLeaving(socket);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
    handleUserLeaving(socket);
    users.delete(socket.id);
  });

  socket.on('error', (error) => {
    console.error('⚠️ Socket error:', error);
  });
});

function handleUserLeaving(socket) {
  const user = users.get(socket.id);
  
  if (user && user.roomId) {
    const room = rooms.get(user.roomId);
    
    if (room) {
      const wasInRoom = room.participants.some(p => p.socketId === socket.id);
      room.participants = room.participants.filter(p => p.socketId !== socket.id);
      
      console.log(`👋🤦‍♂️ User ${user.userId} left room ${user.roomId}`);
      console.log(`Room ${user.roomId} now has ${room.participants.length} participants`);
      
      if (room.participants.length > 0) {
        socket.to(user.roomId).emit('user-disconnected', {
          socketId: socket.id,
          userId: user.userId
        });
      }
    }
    
    socket.leave(user.roomId);
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 HTTPS Signaling server running on https://172.16.0.125:${PORT}`);
  console.log(`📊 Health check: https://172.16.0.125:${PORT}/health`);
});