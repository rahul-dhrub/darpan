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

// Root route
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
    console.log('No code provided in callback');
    return res.status(400).send('No code provided');
  }

  console.log('Authorization code received, length:', code.length);

  try {
    console.log('Attempting to authenticate with code');
    console.log('Using client ID:', process.env.WORKOS_CLIENT_ID.substring(0, 10) + '...');
    console.log('Cookie password length:', process.env.WORKOS_COOKIE_PASSWORD.length);
    
    const authenticateResponse =
      await workos.userManagement.authenticateWithCode({
        clientId: process.env.WORKOS_CLIENT_ID,
        code,
        session: {
          sealSession: true,
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
          options: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          }
        },
      });

    console.log('Authentication successful');
    const { user, sealedSession } = authenticateResponse;
    console.log('Sealed session received, length:', sealedSession.length);

    // Store the session in a cookie
    try {
      console.log('Setting session cookie');
      res.cookie('wos-session', sealedSession, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      console.log('Session cookie set successfully');
    } catch (error) {
      console.error('Error setting cookie:', error);
      console.log('Error type:', error.constructor.name);
      console.log('Error message:', error.message);
      if (error.stack) console.log('Error stack:', error.stack);
      return res.status(500).send('Error setting cookie');
    }
    
    // Use the information in `user` for further business logic.

    // Redirect the user to the homepage
    console.log(`User ${user.firstName} is logged in: detail: `, user);
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Error during authentication:', error);
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    if (error.stack) console.log('Error stack:', error.stack);
    return res.redirect('/');
  }
});



// Auth middleware function
async function withAuth(req, res, next) {
  try {
    console.log('Cookie exists:', !!req.cookies['wos-session']);
    console.log('Cookie length:', req.cookies['wos-session'] ? req.cookies['wos-session'].length : 0);
    console.log('Cookie password length:', process.env.WORKOS_COOKIE_PASSWORD ? process.env.WORKOS_COOKIE_PASSWORD.length : 0);
    console.log('Cookie password (first 10 chars):', process.env.WORKOS_COOKIE_PASSWORD ? process.env.WORKOS_COOKIE_PASSWORD.substring(0, 10) + '...' : 'undefined');
    
    if (!req.cookies['wos-session']) {
      console.log('No session cookie found, redirecting to login');
      return res.redirect('/login');
    }

    const session = workos.userManagement.loadSealedSession({
      sessionData: req.cookies['wos-session'],
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
    });

    console.log('Session loaded successfully');

    try {
      const { authenticated, reason } = await session.authenticate();
      console.log('Authentication result:', { authenticated, reason });

      if (authenticated) {
        console.log('User authenticated successfully');
        return next();
      }
      
      console.log('User not authenticated:', reason);
      console.log('authenticated:', authenticated);
      
      // If the cookie is missing, redirect to login
      if (!authenticated && reason === 'no_session_cookie_provided') {
        console.log('No session cookie provided, redirecting to login');
        return res.redirect('/login');
      }

      // If the JWT is invalid, let's log more details
      if (reason === 'invalid_jwt') {
        console.log('Invalid JWT detected, checking session object format');
        console.log('JWT validation failed, attempting refresh');
      }

      // If the session is invalid, attempt to refresh
      try {
        console.log('Attempting to refresh session');
        const { authenticated, sealedSession } = await session.refresh();
        console.log('Refresh result:', { authenticated });

        if (!authenticated) {
          console.log('Failed to refresh session');
          res.clearCookie('wos-session');
          return res.redirect('/login');
        }

        console.log('Session refreshed successfully');
        // update the cookie
        res.cookie('wos-session', sealedSession, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        console.log('Cookie updated with refreshed session');

        // Redirect to the same route to ensure the updated cookie is used
        return res.redirect(req.originalUrl);
      } catch (e) {
        console.error('Error refreshing token:', e);
        console.log('Error type:', e.constructor.name);
        console.log('Error message:', e.message);
        if (e.stack) console.log('Error stack:', e.stack);
        
        // Failed to refresh access token, redirect user to login page
        // after deleting the cookie
        res.clearCookie('wos-session');
        return res.redirect('/login');
      }
    } catch (authError) {
      console.error('Error during authentication:', authError);
      console.log('Error type:', authError.constructor.name);
      console.log('Error message:', authError.message);
      if (authError.stack) console.log('Error stack:', authError.stack);
      
      res.clearCookie('wos-session');
      return res.redirect('/login');
    }
  } catch (error) {
    console.error('Error in auth middleware:', error);
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    if (error.stack) console.log('Error stack:', error.stack);
    
    res.clearCookie('wos-session');
    return res.redirect('/login');
  } finally {
  }
}

// Specify the `withAuth` middleware function we defined earlier to protect this route
app.get('/dashboard', withAuth, async (req, res) => {
  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData: req.cookies['wos-session'],
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
    });

    const { user, authenticated } = await session.authenticate();
    console.log('Dashboard auth result:', { authenticated });

    if (!authenticated) {
      console.log('User not authenticated in dashboard route');
      return res.redirect('/login');
    }

    console.log(`User ${user.firstName} is logged in`);

    // Generate a random room ID
    const roomId = Math.random().toString(36).substring(2, 12);
    
    // Redirect to device-preview.html with the room ID
    return res.redirect(`/device-preview.html?room=${roomId}`);
  } catch (error) {
    console.error('Error in dashboard route:', error);
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    if (error.stack) console.log('Error stack:', error.stack);
    res.clearCookie('wos-session');
    return res.redirect('/login');
  }
});

app.get('/logout', async (req, res) => {
  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData: req.cookies['wos-session'],
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
    });

    const url = await session.getLogoutUrl({
      redirectURI: 'http://localhost:3000/'
    });
    console.log('Logout URL generated:', url);

    res.clearCookie('wos-session', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    console.log('Session cookie cleared');
    
    res.redirect(url);
  } catch (error) {
    console.error('Error during logout:', error);
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    if (error.stack) console.log('Error stack:', error.stack);
    res.clearCookie('wos-session');
    res.redirect('/');
  }
});

// Add a test route to check JWT validation directly
app.get('/test-auth', (req, res) => {
  try {
    if (!req.cookies['wos-session']) {
      return res.send({ error: 'No session cookie found' });
    }
    
    console.log('Cookie found, length:', req.cookies['wos-session'].length);
    console.log('Cookie password length:', process.env.WORKOS_COOKIE_PASSWORD.length);
    
    try {
      const session = workos.userManagement.loadSealedSession({
        sessionData: req.cookies['wos-session'],
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
      });
      
      console.log('Session loaded successfully');
      
      // Use a try/catch to authenticate and handle errors
      session.authenticate()
        .then(({ authenticated, reason, user }) => {
          console.log('Authentication result:', { authenticated, reason });
          return res.json({ 
            authenticated, 
            reason,
            user: user ? {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName
            } : null
          });
        })
        .catch(authError => {
          console.error('Auth error in test route:', authError);
          console.log('Error type:', authError.constructor.name);
          console.log('Error message:', authError.message);
          return res.json({ 
            error: 'Authentication error', 
            message: authError.message,
            type: authError.constructor.name
          });
        });
    } catch (sessionError) {
      console.error('Session error in test route:', sessionError);
      return res.json({ 
        error: 'Session error',
        message: sessionError.message,
        type: sessionError.constructor.name
      });
    }
  } catch (error) {
    console.error('General error in test route:', error);
    return res.json({ 
      error: 'General error',
      message: error.message,
      type: error.constructor.name
    });
  }
});

// Add a utility route to generate a new secure cookie password (access this carefully!)
app.get('/generate-cookie-password', (req, res) => {
  try {
    const crypto = require('crypto');
    
    // Generate a new secure random cookie password
    const newPassword = crypto.randomBytes(32).toString('base64');
    
    // Log diagnostics
    console.log('Current cookie password length:', process.env.WORKOS_COOKIE_PASSWORD.length);
    console.log('Current cookie password first 10 chars:', process.env.WORKOS_COOKIE_PASSWORD.substring(0, 10) + '...');
    console.log('New cookie password length:', newPassword.length);
    console.log('New cookie password first 10 chars:', newPassword.substring(0, 10) + '...');
    
    // Check for possible issues with the current password
    const currentPasswordIssues = [];
    
    if (process.env.WORKOS_COOKIE_PASSWORD.length !== 44) {
      currentPasswordIssues.push('Current password is not 44 characters (standard base64 length for 32 bytes)');
    }
    
    if (process.env.WORKOS_COOKIE_PASSWORD.includes(' ')) {
      currentPasswordIssues.push('Current password contains spaces');
    }
    
    if (process.env.WORKOS_COOKIE_PASSWORD.endsWith('=123')) {
      currentPasswordIssues.push('Current password has invalid trailing characters (=123)');
    }
    
    // Return diagnostic information
    return res.json({
      message: 'Generated new cookie password - UPDATE YOUR .env FILE',
      newPassword,
      currentPasswordLength: process.env.WORKOS_COOKIE_PASSWORD.length,
      newPasswordLength: newPassword.length,
      currentPasswordIssues,
      instructions: [
        '1. Update your .env file with the new password',
        '2. Restart your server',
        '3. Try logging in again',
        '4. Note: This will invalidate all existing sessions'
      ]
    });
  } catch (error) {
    console.error('Error generating cookie password:', error);
    return res.status(500).json({ error: 'Failed to generate cookie password' });
  }
});

server.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`);
  console.log(`WorkOS API Key (first 10 chars): ${process.env.WORKOS_API_KEY.substring(0, 10)}...`); 
  console.log(`WorkOS Client ID (first 10 chars): ${process.env.WORKOS_CLIENT_ID.substring(0, 10)}...`);
  console.log(`Cookie Password Length: ${process.env.WORKOS_COOKIE_PASSWORD.length}`);
});