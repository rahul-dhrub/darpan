const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Map to store user display names by room
const userDisplayNames = new Map(); // roomId -> Map<userId, displayName>

// Redirect root to home page - must be defined BEFORE static middleware
app.get('/', (req, res) => {
  res.redirect('/home.html');
});

// Static middleware should come after specific routes
app.use(express.static("public"));

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  socket.on("join-room", roomId => {
    socket.join(roomId);
    
    // Initialize room in userDisplayNames map if it doesn't exist
    if (!userDisplayNames.has(roomId)) {
      userDisplayNames.set(roomId, new Map());
    }
    
    // Send all existing user display names to the new user
    const roomUsers = userDisplayNames.get(roomId);
    if (roomUsers && roomUsers.size > 0) {
      console.log(`Sending ${roomUsers.size} existing display names to new user ${socket.id}`);
      roomUsers.forEach((name, userId) => {
        socket.emit("name-update", {
          userId: userId,
          name: name
        });
      });
    }
    
    // Broadcast to all other users in the room that a new user has joined
    socket.to(roomId).emit("user-connected", socket.id);
    console.log(`User ${socket.id} joined room ${roomId}`);

    socket.on("disconnect", () => {
      // Remove user from display names map
      const roomUsers = userDisplayNames.get(roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        // Clean up empty rooms
        if (roomUsers.size === 0) {
          userDisplayNames.delete(roomId);
        }
      }
      
      socket.to(roomId).emit("user-disconnected", socket.id);
      console.log(`User ${socket.id} disconnected from room ${roomId}`);
    });

    socket.on("offer", data => {
      console.log(`Offer received from ${socket.id} to ${data.to}`);
      socket.to(data.to).emit("offer", {
        from: socket.id,
        offer: data.offer,
        isScreenShare: data.isScreenShare || false
      });
    });

    socket.on("answer", data => {
      console.log(`Answer received from ${socket.id} to ${data.to}`);
      socket.to(data.to).emit("answer", {
        from: socket.id,
        answer: data.answer,
        isScreenShare: data.isScreenShare || false
      });
    });

    socket.on("ice-candidate", data => {
      socket.to(data.to).emit("ice-candidate", {
        from: socket.id,
        candidate: data.candidate,
        isScreenShare: data.isScreenShare || false
      });
    });

    socket.on("screen-sharing-stopped", roomId => {
      socket.to(roomId).emit("user-stopped-screen-sharing", socket.id);
    });

    socket.on("chat-message", data => {
      socket.to(data.room).emit("chat-message", {
        message: data.message,
        sender: socket.id,
        senderName: data.senderName || `User ${socket.id.substring(0, 5)}`
      });
    });
    
    // Handle mic status changes
    socket.on("mic-status-change", data => {
      console.log(`Mic status change from ${socket.id}: ${data.isOn ? 'on' : 'off'}`);
      socket.to(data.room).emit("mic-status-change", {
        from: socket.id,
        isOn: data.isOn
      });
    });
    
    // Handle video status changes
    socket.on("video-status-change", data => {
      console.log(`Video status change from ${socket.id}: ${data.isOn ? 'on' : 'off'}`);
      socket.to(data.room).emit("video-status-change", {
        from: socket.id,
        isOn: data.isOn
      });
    });
    
    // Handle peer count messages
    socket.on("peer-count", data => {
      socket.to(data.to).emit("peer-count", {
        count: data.count
      });
    });
    
    // Handle emoji reactions
    socket.on("reaction", data => {
      console.log(`Reaction from ${socket.id}: ${data.emoji}`);
      socket.to(data.room).emit("reaction", {
        userId: socket.id,
        emoji: data.emoji
      });
    });
    
    // Handle raise hand events
    socket.on("raise-hand", () => {
      console.log(`Hand raised by ${socket.id}`);
      socket.to(roomId).emit("hand-raised", {
        peerId: socket.id
      });
    });
    
    socket.on("lower-hand", () => {
      console.log(`Hand lowered by ${socket.id}`);
      socket.to(roomId).emit("hand-lowered", {
        peerId: socket.id
      });
    });

    // Handle name updates
    socket.on("name-update", data => {
      console.log(`Name update from ${socket.id}: ${data.name}`);
      
      // Store the display name in the map
      const roomUsers = userDisplayNames.get(data.room);
      if (roomUsers) {
        roomUsers.set(socket.id, data.name);
      }
      
      // If there's a specific target user, only send to them
      if (data.targetUser) {
        socket.to(data.targetUser).emit("name-update", {
          userId: socket.id,
          name: data.name
        });
        console.log(`Sent targeted name update to ${data.targetUser}`);
      } else {
        // Otherwise broadcast to the whole room
        socket.to(data.room).emit("name-update", {
          userId: socket.id,
          name: data.name
        });
        console.log(`Broadcast name update to room ${data.room}`);
      }
    });
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
