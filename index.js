require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { WorkOS } = require('@workos-inc/node');
const cookieParser = require("cookie-parser");


const app = express();
const server = http.createServer(app);
const io = new Server(server);

const workos = new WorkOS(process.env.WORKOS_API_KEY, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

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

// This `/login` endpoint should be registered as the initiate login URL
// on the "Redirects" page of the WorkOS Dashboard.
app.get('/login', (req, res) => {
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    // Specify that we'd like AuthKit to handle the authentication flow
    provider: 'authkit',

    // The callback endpoint that WorkOS will redirect to after a user authenticates
    redirectUri: 'http://localhost:3000/callback',
    clientId: process.env.WORKOS_CLIENT_ID,
  });

  // Redirect the user to the AuthKit sign-in page
  res.redirect(authorizationUrl);
});


app.use(cookieParser());  

app.get('/callback', async (req, res) => {
  // The authorization code returned by AuthKit
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const authenticateResponse =
      await workos.userManagement.authenticateWithCode({
        clientId: process.env.WORKOS_CLIENT_ID,
        code,
        session: {
          sealSession: true,
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
        },
      });

    const { user, sealedSession } = authenticateResponse;

    // Store the session in a cookie
    try{
        res.cookie('wos-session', sealedSession, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    } catch (error) {
      console.error('Error setting cookie:', error);
      return res.status(500).send('Error setting cookie');
    }
    
    // Use the information in `user` for further business logic.

    // Redirect the user to the homepage
    console.log(`User ${user.firstName} is logged in: detail: `, user);
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Error during authentication:', error);
    return res.redirect('/');
  }
});



// Auth middleware function
async function withAuth(req, res, next) {
  const session = workos.userManagement.loadSealedSession({
    sessionData: req.cookies['wos-session'],
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
  });

  const { authenticated, reason } = await session.authenticate();

  if (authenticated) {
    return next();
  }
  console.log('User not authenticated:', reason);
  console.log('authenticated:', authenticated);
  // If the cookie is missing, redirect to login
  if (!authenticated && reason === 'no_session_cookie_provided') {
    return res.redirect('/login');
  }

  // If the session is invalid, attempt to refresh
  try {
    const { authenticated, sealedSession } = await session.refresh();

    if (!authenticated) {
      return res.redirect('/login');
    }

    // update the cookie
    res.cookie('wos-session', sealedSession, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    // Redirect to the same route to ensure the updated cookie is used
    return res.redirect(req.originalUrl);
  } catch (e) {
    // Failed to refresh access token, redirect user to login page
    // after deleting the cookie
    res.clearCookie('wos-session');
    res.redirect('/login');
  }
}

// Specify the `withAuth` middleware function we defined earlier to protect this route
app.get('/dashboard', withAuth, async (req, res) => {
  const session = workos.userManagement.loadSealedSession({
    sessionData: req.cookies['wos-session'],
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
  });

  const { user } = await session.authenticate();

  console.log(`User ${user.firstName} is logged in`);

  // ... render dashboard page
});

app.get('/logout', async (req, res) => {
  const session = workos.userManagement.loadSealedSession({
    sessionData: req.cookies['wos-session'],
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
  });

  const url = await session.getLogoutUrl();

  res.clearCookie('wos-session');
  res.redirect(url);
});

server.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`);
});
