const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store room data
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Set(),
        canvasState: null
      });
    }
    
    const room = rooms.get(roomId);
    room.users.add(socket.id);
    
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Send current user count to all users in room
    io.to(roomId).emit('user-count', room.users.size);
    
    // Send existing canvas state to new user
    if (room.canvasState) {
      socket.emit('canvas-state', room.canvasState);
    }
  });

  socket.on('draw-start', (data) => {
    socket.to(data.roomId).emit('draw-start', data);
  });

  socket.on('drawing', (data) => {
    socket.to(data.roomId).emit('drawing', data);
  });

  socket.on('draw-end', (data) => {
    socket.to(data.roomId).emit('draw-end', data);
  });

  socket.on('draw-shape', (data) => {
    socket.to(data.roomId).emit('draw-shape', data);
  });

  socket.on('canvas-state', (data) => {
    // Save canvas state for the room
    if (rooms.has(data.roomId)) {
      rooms.get(data.roomId).canvasState = data.imageData;
    }
    // Broadcast to other users (optional, for real-time sync)
    socket.to(data.roomId).emit('canvas-state', data.imageData);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from all rooms and update counts
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        io.to(roomId).emit('user-count', room.users.size);
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});