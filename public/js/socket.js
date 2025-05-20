// Module for socket connection and WebRTC peer connections
import { updateGridLayout } from './layout.js';
import { addPinButton, unpinVideo } from './video-pin.js';
import { addStatusIndicators, updatePeerMicStatus, updatePeerVideoStatus } from './status-indicators.js';
import { announceToScreenReaders, addVideoLoadedListener } from './utils.js';
import { updateParticipantCount } from './ui.js';
import { stopScreenSharing, shareScreenWithUser } from './screen-share.js';

// Create a peer connection
function createPeer(userId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peer.onicecandidate = event => {
    if (event.candidate) {
      window.socket.emit("ice-candidate", {
        to: userId,
        candidate: event.candidate,
        isScreenShare: false
      });
    }
  };

  peer.ontrack = event => {
    console.log(`Received track from peer ${userId}:`, event.track.kind);
    
    // Check if video already exists
    let videoContainer = document.getElementById(`video-container-${userId}`);
    let remoteVideo = document.getElementById(userId);
    
    if (!videoContainer) {
      console.log(`Creating new video container for ${userId}`);
      // Create new container for video
      videoContainer = document.createElement("div");
      videoContainer.id = `video-container-${userId}`;
      videoContainer.classList.add("video-item");
      
      // Create new video element
      remoteVideo = document.createElement("video");
      remoteVideo.id = userId;
      remoteVideo.autoplay = true;
      remoteVideo.playsinline = true;
      
      // Add aspect ratio listener
      addVideoLoadedListener(remoteVideo);
      
      // Create label
      const label = document.createElement("div");
      label.classList.add("user-label");
      // Use a default name based on user ID
      label.textContent = `User ${userId.substring(0, 5)}`;
      
      // Add to DOM
      videoContainer.appendChild(remoteVideo);
      videoContainer.appendChild(label);
      
      // Add status indicators
      addStatusIndicators(videoContainer, userId);
      
      // Add to the appropriate container based on pinned state
      if (window.pinnedVideoId) {
        // If we're in pinned mode, create a sidebar version instead
        const sidebarContainer = videoContainer.cloneNode(true);
        const sidebarVideo = sidebarContainer.querySelector('video');
        sidebarVideo.id = `sidebar-${userId}`;
        sidebarContainer.id = `sidebar-container-${userId}`;
        
        // Set srcObject to the stream
        sidebarVideo.srcObject = event.streams[0];
        
        // Add aspect ratio listener for sidebar video
        addVideoLoadedListener(sidebarVideo);
        
        // Add pin button
        addPinButton(sidebarContainer, `sidebar-${userId}`);
        
        // Add to sidebar
        window.participantsSidebar.appendChild(sidebarContainer);
        
        // Still add the original container to the videos div but hide it
        addPinButton(videoContainer, userId);
        videoContainer.style.display = 'none';
        window.videosDiv.appendChild(videoContainer);
      } else {
        // Normal mode - add to grid
        addPinButton(videoContainer, userId);
        window.videosDiv.appendChild(videoContainer);
      }
      
      // Update grid layout
      updateGridLayout();
    }
    
    // Set the stream to the video
    remoteVideo.srcObject = event.streams[0];
    
    // Play the video
    remoteVideo.play().catch(e => console.error("Error playing remote video:", e));
  };

  return peer;
}

// Create a peer connection for screen sharing
function createScreenPeer(userId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peer.onicecandidate = event => {
    if (event.candidate) {
      window.socket.emit("ice-candidate", {
        to: userId,
        candidate: event.candidate,
        isScreenShare: true
      });
    }
  };

  peer.ontrack = event => {
    // Check if video already exists
    let videoContainer = document.getElementById(`screen-container-${userId}`);
    let screenVideo = document.getElementById(`screen-${userId}`);
    
    if (!videoContainer) {
      // Create new container for video
      videoContainer = document.createElement("div");
      videoContainer.id = `screen-container-${userId}`;
      videoContainer.classList.add("video-item", "new-screen-share", "screen-share-container");
      
      // Create new video element
      screenVideo = document.createElement("video");
      screenVideo.id = `screen-${userId}`;
      screenVideo.autoplay = true;
      screenVideo.playsinline = true;
      screenVideo.classList.add("screen-share");
      
      // Add screen share icon
      const screenIcon = document.createElement("div");
      screenIcon.classList.add("screen-share-icon");
      screenIcon.innerHTML = '<span class="material-icons">screen_share</span>';
      
      // Add aspect ratio listener for screen sharing
      addVideoLoadedListener(screenVideo);
      
      // Create label
      const label = document.createElement("div");
      label.classList.add("user-label");
      
      // Use display name if available, otherwise fall back to ID
      const displayName = window.peerDisplayNames?.get(userId) || window.userDisplayName || `User ${userId.substring(0, 5)}`;
      label.textContent = `Screen: ${displayName}`;
      
      // Add to DOM
      videoContainer.appendChild(screenVideo);
      videoContainer.appendChild(label);
      videoContainer.appendChild(screenIcon);
      
      // Add to the appropriate container based on pinned state
      if (window.pinnedVideoId) {
        // If we're in pinned mode, create a sidebar version
        const sidebarContainer = document.createElement("div");
        sidebarContainer.id = `sidebar-screen-container-${userId}`;
        sidebarContainer.classList.add("video-item", "screen-share-container");
        
        const sidebarVideo = document.createElement("video");
        sidebarVideo.id = `sidebar-screen-${userId}`;
        sidebarVideo.autoplay = true;
        sidebarVideo.playsinline = true;
        sidebarVideo.classList.add("screen-share");
        
        // Create sidebar label
        const sidebarLabel = document.createElement("div");
        sidebarLabel.classList.add("user-label");
        sidebarLabel.textContent = `Screen: ${displayName}`;
        
        // Clone the screen icon for sidebar
        const sidebarIcon = screenIcon.cloneNode(true);
        
        // Set srcObject to the stream
        sidebarVideo.srcObject = event.streams[0];
        
        // Add aspect ratio listener for sidebar screen
        addVideoLoadedListener(sidebarVideo);
        
        // Add elements to sidebar container
        sidebarContainer.appendChild(sidebarVideo);
        sidebarContainer.appendChild(sidebarLabel);
        sidebarContainer.appendChild(sidebarIcon);
        
        // Add pin button
        addPinButton(sidebarContainer, `sidebar-screen-${userId}`);
        
        // Add to sidebar
        window.participantsSidebar.appendChild(sidebarContainer);
        
        // Play the video
        sidebarVideo.play().catch(e => console.error("Error playing sidebar screen video:", e));
        
        // Still add the original container but hide it
        addPinButton(videoContainer, `screen-${userId}`);
        videoContainer.style.display = 'none';
        window.videosDiv.appendChild(videoContainer);
      } else {
        // Normal mode - add to grid
        addPinButton(videoContainer, `screen-${userId}`);
        window.videosDiv.appendChild(videoContainer);
        
        // Option to auto-pin remote screen shares
        const autoPinRemoteScreenShare = false; // Set to true to enable auto-pinning of remote screen shares
        if (autoPinRemoteScreenShare) {
          setTimeout(() => {
            // Add pinning animation
            videoContainer.classList.add('pinning');
            setTimeout(() => {
              videoContainer.classList.remove('pinning');
              pinVideo(`screen-${userId}`);
            }, 300);
          }, 500);
        }
      }
      
      // Remove animation class after it plays
      setTimeout(() => {
        videoContainer.classList.remove("new-screen-share");
      }, 6000);
      
      // Update grid layout
      updateGridLayout();
      
      // Announce new screen share for screen readers
      announceToScreenReaders(`Screen sharing from User ${userId.substring(0, 5)} started`);
    }
    
    // Set the stream to the video
    screenVideo.srcObject = event.streams[0];
    
    // Play the video
    screenVideo.play().catch(e => console.error("Error playing screen video:", e));
  };

  return peer;
}

// Set up all socket event listeners
function setupSocketListeners() {
  // When this client connects to the server
  window.socket.on("connect", () => {
    console.log("Connected to server with ID:", window.socket.id);
  });

  // When a new user joins (Note: this event is not being emitted by the server)
  window.socket.on("user-joined", userId => {
    console.log("User joined event received for:", userId);
    // The server is using "user-connected" instead of "user-joined"
    console.warn("user-joined event was received, but the server should be using user-connected");
    
    // For backwards compatibility, we'll still handle this event the same way
    // Create a peer connection for this user
    if (!window.peers[userId]) {
      console.log(`Creating new peer connection for user ${userId} (via user-joined)`);
      const peer = createPeer(userId);
      window.peers[userId] = peer;
      
      // Add all local tracks to the peer connection
      if (window.localStream) {
        window.localStream.getTracks().forEach(track => {
          peer.addTrack(track, window.localStream);
        });
      }
      
      // Send an offer to the new user
      peer.createOffer()
        .then(offer => peer.setLocalDescription(offer))
        .then(() => {
          window.socket.emit("offer", {
            to: userId,
            offer: peer.localDescription
          });
          console.log(`Offer sent to user ${userId} (via user-joined)`);
        })
        .catch(error => {
          console.error(`Error creating offer for ${userId}:`, error);
        });
      
      // If we have active screen sharing, share it with the new user
      if (window.screenSharingActive && window.screenStream) {
        shareScreenWithUser(userId);
      }
      
      // Update participant count
      window.totalParticipants = Object.keys(window.peers).length + 1; // +1 for local user
      updateParticipantCount();
      
      // Announce for screen readers
      announceToScreenReaders(`New participant joined. Total participants: ${window.totalParticipants}`);
    } else {
      console.log(`Peer connection for ${userId} already exists (via user-joined)`);
    }
  });
  
  // Handle incoming reaction from other user
  window.socket.on("reaction", data => {
    // Import the reactions module dynamically
    import('./reactions.js').then(module => {
      if (data && data.emoji) {
        // Show the emoji
        module.showFloatingEmoji(data.emoji);
      }
    });
  });

  window.socket.on("user-connected", userId => {
    console.log('User connected with ID: ' + userId);
    
    // Update participant count
    window.totalParticipants++;
    updateParticipantCount();
    
    // Check if peer already exists
    if (window.peers[userId]) {
      console.log(`Peer connection for ${userId} already exists, not creating a new one`);
      return;
    }
    
    console.log(`Creating new peer connection for user ${userId}`);
    const peer = createPeer(userId);
    window.peers[userId] = peer;
    
    // Make sure we have the local stream before trying to add tracks
    if (!window.localStream) {
      console.error("Local stream is not available, cannot add tracks to peer connection");
      return;
    }
    
    console.log(`Adding ${window.localStream.getTracks().length} local tracks to the peer connection`);
    window.localStream.getTracks().forEach(track => {
      peer.addTrack(track, window.localStream);
    });

    console.log("Creating and sending offer to new user");
    peer.createOffer().then(offer => {
      return peer.setLocalDescription(offer);
    }).then(() => {
      window.socket.emit("offer", { 
        to: userId, 
        offer: peer.localDescription 
      });
      console.log(`Offer sent to user ${userId}`);
    }).catch(error => {
      console.error(`Error creating or sending offer to ${userId}:`, error);
    });

    // If we are currently sharing screen, also share with the new user
    if (window.screenSharingActive && window.screenStream) {
      console.log(`Sharing active screen with new user ${userId}`);
      shareScreenWithUser(userId);
    }
    
    // Send the current user count to the newly connected user
    window.socket.emit("peer-count", {
      to: userId,
      count: Object.keys(window.peers).length
    });
    
    // Send our display name to the new user
    if (window.userDisplayName) {
      setTimeout(() => {
        window.socket.emit("name-update", {
          room: window.ROOM_ID,
          name: window.userDisplayName,
          targetUser: userId
        });
        console.log(`Sent our display name "${window.userDisplayName}" to new user ${userId}`);
      }, 2000); // Slight delay to ensure connection is established
    }
  });

  // Handle receiving peer count from existing users
  window.socket.on("peer-count", ({ count }) => {
    console.log('Received peer count:', count);
    // Add the count to our total participants (plus 1 for ourselves)
    // We also need to make sure we don't double count if multiple users send counts
    const currentPeers = Object.keys(window.peers).length;
    
    // If we've received a count from someone who is connected before we added them
    // to our peers object, consider that number. Otherwise, use our own count.
    if (count > currentPeers) {
      window.totalParticipants = count + 1; // +1 for ourselves
    } else {
      window.totalParticipants = currentPeers + 1; // +1 for ourselves
    }
    
    updateParticipantCount();
  });

  window.socket.on("offer", ({ from, offer, isScreenShare }) => {
    let peer;
    
    if (isScreenShare) {
      // This is a screen sharing offer
      peer = createScreenPeer(from);
      window.screenSharingPeers[from] = peer;
    } else {
      // This is a regular video offer
      peer = createPeer(from);
      window.peers[from] = peer;
      
      window.localStream.getTracks().forEach(track => {
        peer.addTrack(track, window.localStream);
      });
    }

    peer.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
      return peer.createAnswer();
    }).then(answer => {
      peer.setLocalDescription(answer);
      window.socket.emit("answer", { 
        to: from, 
        answer,
        isScreenShare 
      });
    });
  });

  window.socket.on("answer", ({ from, answer, isScreenShare }) => {
    if (isScreenShare && window.screenSharingPeers[from]) {
      window.screenSharingPeers[from].setRemoteDescription(new RTCSessionDescription(answer));
    } else if (!isScreenShare && window.peers[from]) {
      window.peers[from].setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  window.socket.on("ice-candidate", ({ from, candidate, isScreenShare }) => {
    if (isScreenShare && window.screenSharingPeers[from]) {
      window.screenSharingPeers[from].addIceCandidate(new RTCIceCandidate(candidate));
    } else if (!isScreenShare && window.peers[from]) {
      window.peers[from].addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  window.socket.on("user-disconnected", userId => {
    console.log('User disconnected: ' + userId);
    
    // Update participant count only if the peer exists
    // to prevent decreasing count for duplicate disconnects
    if (window.peers[userId]) {
      window.totalParticipants = Math.max(1, window.totalParticipants - 1);
      updateParticipantCount();
    }
    
    // Check if the disconnected user was pinned
    if (window.pinnedVideoId === userId || window.pinnedVideoId === `screen-${userId}`) {
      unpinVideo();
    }
    
    if (window.peers[userId]) {
      window.peers[userId].close();
      delete window.peers[userId];
    }
    if (window.screenSharingPeers[userId]) {
      window.screenSharingPeers[userId].close();
      delete window.screenSharingPeers[userId];
    }

    // Remove video container
    const videoContainer = document.getElementById(`video-container-${userId}`);
    if (videoContainer) {
      console.log(`Removing video container for disconnected user ${userId}`);
      videoContainer.remove();
      // Update grid layout
      updateGridLayout();
    } else {
      console.warn(`Video container for user ${userId} not found when trying to remove it`);
    }
    
    // Remove screen share container
    const screenContainer = document.getElementById(`screen-container-${userId}`);
    if (screenContainer) {
      screenContainer.remove();
      // Update grid layout
      updateGridLayout();
    }
  });

  // Add event handler for when a user stops screen sharing
  window.socket.on("user-stopped-screen-sharing", userId => {
    // Check if the stopped screen share was pinned
    if (window.pinnedVideoId === `screen-${userId}`) {
      unpinVideo();
    }
    
    if (window.screenSharingPeers[userId]) {
      window.screenSharingPeers[userId].close();
      delete window.screenSharingPeers[userId];
    }
    
    // Remove screen container
    const screenContainer = document.getElementById(`screen-container-${userId}`);
    if (screenContainer) {
      screenContainer.remove();
      // Update grid layout
      updateGridLayout();
    }
  });

  window.socket.on("chat-message", ({ message, sender, senderName }) => {
    addMessage(message, senderName || "User", false);
  });

  window.socket.on("mic-status-change", ({ from, isOn }) => {
    updatePeerMicStatus(from, isOn);
  });

  window.socket.on("video-status-change", ({ from, isOn }) => {
    updatePeerVideoStatus(from, isOn);
  });

  // Handle name updates from other users
  window.socket.on("name-update", data => {
    console.log(`Name update received for user ${data.userId}: ${data.name}`);
    
    // Update the user's name in the UI
    updatePeerDisplayName(data.userId, data.name);
  });
}

// Helper function to add chat messages
function addMessage(message, sender, isSent) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", isSent ? "message-sent" : "message-received");
  
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  messageElement.innerHTML = `
    ${message}
    <span class="message-meta">${sender} · ${time}</span>
  `;
  
  window.chatMessages.appendChild(messageElement);
  window.chatMessages.scrollTop = window.chatMessages.scrollHeight;
  
  // If chat is not visible, highlight the chat button
  if (!window.chatVisible) {
    window.chatToggleBtn.classList.add("active");
  }
}

// Function to update a peer's display name in the UI
function updatePeerDisplayName(userId, newName) {
  console.log(`Updating display name for peer ${userId} to "${newName}"`);
  
  // Store in a peer names map for future reference
  if (!window.peerDisplayNames) {
    window.peerDisplayNames = new Map();
  }
  window.peerDisplayNames.set(userId, newName);
  
  // Update in regular video container
  const videoContainer = document.getElementById(`video-container-${userId}`);
  if (videoContainer) {
    const label = videoContainer.querySelector('.user-label');
    if (label) {
      // Check if the nameSpan exists already
      let nameSpan = label.querySelector('.name-text');
      if (nameSpan) {
        nameSpan.textContent = newName;
      } else {
        // If not, update the entire label
        label.textContent = newName;
      }
    }
  }
  
  // Update in sidebar if in pinned mode
  const sidebarContainer = document.getElementById(`sidebar-container-${userId}`);
  if (sidebarContainer) {
    const sidebarLabel = sidebarContainer.querySelector('.user-label');
    if (sidebarLabel) {
      // Check if the nameSpan exists already
      let nameSpan = sidebarLabel.querySelector('.name-text');
      if (nameSpan) {
        nameSpan.textContent = newName;
      } else {
        // If not, update the entire label
        sidebarLabel.textContent = newName;
      }
    }
  }
  
  // Update screen share containers if they exist
  const screenContainer = document.getElementById(`screen-container-${userId}`);
  if (screenContainer) {
    const screenLabel = screenContainer.querySelector('.user-label');
    if (screenLabel) {
      // Screen share labels don't have the name-text class
      screenLabel.textContent = `Screen: ${newName}`;
    }
  }
  
  // Update sidebar screen container if it exists
  const sidebarScreenContainer = document.getElementById(`sidebar-screen-container-${userId}`);
  if (sidebarScreenContainer) {
    const sidebarScreenLabel = sidebarScreenContainer.querySelector('.user-label');
    if (sidebarScreenLabel) {
      // Screen share labels don't have the name-text class
      sidebarScreenLabel.textContent = `Screen: ${newName}`;
    }
  }
  
  // If this peer has raised hand, update the notification text
  if (window.participantsWithRaisedHands && window.participantsWithRaisedHands.has(userId)) {
    updateRaisedHandNotifications(userId, newName);
  }
  
  // Update chat messages if there are any from this user
  updateChatMessagesWithNewName(userId, newName);
}

// Function to update raised hand notifications with new name
function updateRaisedHandNotifications(userId, newName) {
  // Find any hand raise notifications for this user and update them
  const handNotifications = document.querySelectorAll('.hand-raise-notification');
  handNotifications.forEach(notification => {
    const content = notification.textContent;
    if (content && content.includes(`User ${userId.substring(0, 5)} raised their hand`)) {
      notification.textContent = `${newName} raised their hand`;
    }
  });
  
  // Update tooltip on hand indicators
  const handIndicator = document.querySelector(`.video-container-${userId} .hand-raised-indicator`);
  if (handIndicator) {
    handIndicator.title = `${newName} has raised their hand`;
  }
}

// Function to update chat messages with new display name
function updateChatMessagesWithNewName(userId, newName) {
  const chatMessages = document.querySelectorAll('.message-received .message-meta');
  const shortUserId = userId.substring(0, 5);
  
  chatMessages.forEach(meta => {
    // Find messages that contain the user's ID or old generic name
    if (meta.textContent.includes(`User ${shortUserId}`) || 
        meta.textContent.startsWith(`User ${shortUserId}`)) {
      // Replace with new name
      meta.textContent = meta.textContent.replace(`User ${shortUserId}`, newName);
    }
  });
}

export {
  createPeer,
  createScreenPeer,
  addMessage,
  setupSocketListeners,
  updatePeerDisplayName
}; 