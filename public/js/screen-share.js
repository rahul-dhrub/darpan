// Module for screen sharing functionality
import { updateGridLayout } from './layout.js';
import { checkAndRestoreVideos } from './layout.js';
import { announceToScreenReaders, addVideoLoadedListener } from './utils.js';
import { unpinVideo } from './video-pin.js';
import { addPinButton } from './video-pin.js';

// Start screen sharing
async function startScreenSharing() {
  try {
    console.log("Starting screen sharing");
    // Get screen sharing stream
    window.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always"
      },
      audio: false
    });
    
    console.log("Screen sharing stream obtained:", window.screenStream);
    window.screenSharingActive = true;
    
    // Create local screen sharing container
    createLocalScreenShareContainer();
    
    // Share to all connected peers
    Object.keys(window.peers).forEach(userId => {
      shareScreenWithUser(userId);
    });
    
    // Update button states
    if (window.screenShareBtn) {
      window.screenShareBtn.disabled = true;
    }
    if (window.stopScreenShareBtn) {
      window.stopScreenShareBtn.disabled = false;
    }
    
    // Detect when user stops screen sharing natively
    window.screenStream.getVideoTracks()[0].onended = () => {
      console.log("User ended screen sharing via browser UI");
      stopScreenSharing();
    };
    
    // Announce for screen readers
    import('./utils.js').then(module => {
      module.announceToScreenReaders("Screen sharing started");
    });
    
  } catch (err) {
    console.error("Error starting screen sharing:", err);
    window.screenSharingActive = false;
    alert("Could not start screen sharing. Please make sure you have granted the necessary permissions.");
  }
}

// Stop screen sharing
function stopScreenSharing() {
  if (!window.screenSharingActive) return;
  
  // If the screen share is pinned, unpin it first
  if (window.pinnedVideoId === "local-screen") {
    unpinVideo();
  }
  
  // Stop all screen tracks
  if (window.screenStream) {
    window.screenStream.getTracks().forEach(track => track.stop());
    window.screenStream = null;
  }
  
  // Close all screen sharing peer connections
  Object.values(window.screenSharingPeers).forEach(peer => peer.close());
  window.screenSharingPeers = {};
  
  // Remove screen preview container
  const screenContainer = document.getElementById("local-screen-container");
  if (screenContainer) {
    screenContainer.remove();
    // Update grid layout
    updateGridLayout();
  }
  
  // Remove sidebar screen container if exists
  const sidebarScreenContainer = document.getElementById("sidebar-local-screen-container");
  if (sidebarScreenContainer) {
    sidebarScreenContainer.remove();
  }
  
  // Make sure the local video is visible
  const localVideoContainer = document.getElementById("container-local");
  if (localVideoContainer) {
    localVideoContainer.style.display = '';
    
    // Play the video
    const localVideo = document.getElementById("local");
    if (localVideo && localVideo.srcObject) {
      localVideo.play().catch(e => console.error("Error playing local video after screen sharing:", e));
    }
  }
  
  // IMPORTANT: Completely recreate the local video stream
  if (window.cameraVideoTrack) {
    // Create a fresh MediaStream with the saved camera track
    const newStream = new MediaStream();
    newStream.addTrack(window.cameraVideoTrack);
    
    // Add audio tracks from the existing stream if they exist
    if (window.localStream) {
      const audioTracks = window.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        newStream.addTrack(audioTracks[0]);
      }
    }
    
    // Replace localStream with our new stream
    window.localStream = newStream;
    
    // Update local video with new stream
    const localVideo = document.getElementById("local");
    if (localVideo) {
      localVideo.srcObject = window.localStream;
      localVideo.play().catch(e => console.error("Error playing local video after screen sharing:", e));
    }
    
    // Enable video if it was previously enabled
    if (window.videoEnabled && window.cameraVideoTrack) {
      window.cameraVideoTrack.enabled = true;
    }
    
    // Update all peers with the new video track
    Object.values(window.peers).forEach(peer => {
      const senders = peer.getSenders();
      const videoSender = senders.find(sender => 
        sender.track && sender.track.kind === 'video'
      );
      
      if (videoSender && window.cameraVideoTrack) {
        videoSender.replaceTrack(window.cameraVideoTrack)
          .catch(e => console.error("Error replacing track:", e));
      } else if (window.cameraVideoTrack) {
        // If no video sender found, add the track
        peer.addTrack(window.cameraVideoTrack, window.localStream);
      }
    });
  } else {
    // If we don't have a stored camera track, try to request camera access again
    navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }).then(stream => {
      // Set as new local stream
      window.localStream = stream;
      
      // Save the new camera video track
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        window.cameraVideoTrack = videoTracks[0];
        // Honor user's video preference
        window.cameraVideoTrack.enabled = window.videoEnabled;
      }
      
      // Update local video
      const localVideo = document.getElementById("local");
      if (localVideo) {
        localVideo.srcObject = stream;
        localVideo.play().catch(e => console.error("Error playing local video after reconnect:", e));
      }
      
      // Update all peer connections
      Object.keys(window.peers).forEach(userId => {
        const peer = window.peers[userId];
        // Replace existing tracks
        stream.getTracks().forEach(track => {
          const senders = peer.getSenders();
          const sender = senders.find(s => s.track && s.track.kind === track.kind);
          
          if (sender) {
            sender.replaceTrack(track)
              .catch(e => console.error("Error replacing track after reconnect:", e));
          } else {
            peer.addTrack(track, stream);
          }
        });
      });
      
      // Announce recovery
      announceToScreenReaders("Camera video restored");
    }).catch(err => {
      console.error("Failed to restore camera after screen sharing:", err);
      announceToScreenReaders("Failed to restore camera. Please refresh your browser.");
    });
  }
  
  // Notify others that screen sharing has stopped
  window.socket.emit("screen-sharing-stopped", window.ROOM_ID);
  
  window.screenSharingActive = false;
  window.screenShareBtn.disabled = false;
  window.screenShareBtn.classList.remove('active');
  window.stopScreenShareBtn.disabled = true;
  
  // Ensure all video containers are visible
  setTimeout(() => {
    // Check all videos for visibility issues
    checkAndRestoreVideos();
    // Make sure grid layout is updated properly
    updateGridLayout();
  }, 200);
}

// Share screen with a specific user
function shareScreenWithUser(userId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  
  window.screenSharingPeers[userId] = peer;
  
  peer.onicecandidate = event => {
    if (event.candidate) {
      window.socket.emit("ice-candidate", {
        to: userId,
        candidate: event.candidate,
        isScreenShare: true
      });
    }
  };
  
  // Add screen track to peer connection
  window.screenStream.getTracks().forEach(track => {
    peer.addTrack(track, window.screenStream);
  });
  
  // Set video encoder preferences for better quality
  // Check if browser supports encoder configuration
  if (typeof RTCRtpSender !== 'undefined' && 
      typeof RTCRtpSender.prototype.getParameters === 'function' &&
      typeof RTCRtpSender.prototype.setParameters === 'function') {
    
    const senders = peer.getSenders();
    const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
    
    if (videoSender) {
      const parameters = videoSender.getParameters();
      // Only modify if encodings are available
      if (parameters.encodings && parameters.encodings.length > 0) {
        // Set a higher priority and bitrate for screen sharing
        parameters.encodings[0].priority = 'high';
        parameters.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
        videoSender.setParameters(parameters).catch(e => {
          console.error("Error setting encoder parameters:", e);
        });
      }
    }
  }
  
  // Create and send offer
  peer.createOffer().then(offer => {
    peer.setLocalDescription(offer);
    window.socket.emit("offer", { 
      to: userId, 
      offer,
      isScreenShare: true 
    });
  });
  
  // Return the peer for possible future reference
  return peer;
}

// Create screen sharing video container
function createLocalScreenShareContainer() {
  const videoContainer = document.createElement("div");
  videoContainer.id = "local-screen-container";
  videoContainer.classList.add("video-item", "screen-share-container");
  
  const localScreenVideo = document.createElement("video");
  localScreenVideo.id = "local-screen";
  localScreenVideo.muted = true;
  localScreenVideo.autoplay = true;
  localScreenVideo.playsinline = true;
  localScreenVideo.srcObject = window.screenStream;
  localScreenVideo.classList.add("screen-share");
  
  localScreenVideo.play().catch(e => console.error("Error playing local screen video:", e));
  
  // Add screen share icon
  const screenIcon = document.createElement("div");
  screenIcon.classList.add("screen-share-icon");
  screenIcon.innerHTML = '<span class="material-icons">screen_share</span>';
  
  // Create label with display name
  const label = document.createElement("div");
  label.classList.add("user-label");
  label.textContent = `Screen: ${window.userDisplayName || "You"}`;
  
  // Add to DOM
  videoContainer.appendChild(localScreenVideo);
  videoContainer.appendChild(label);
  videoContainer.appendChild(screenIcon);
  
  // Add to videos grid
  if (window.pinnedVideoId) {
    // If we're in pinned mode, create a sidebar version instead
    const sidebarContainer = document.createElement("div");
    sidebarContainer.id = "sidebar-local-screen-container";
    sidebarContainer.classList.add("video-item", "screen-share-container");
    
    const sidebarVideo = document.createElement("video");
    sidebarVideo.id = "sidebar-local-screen";
    sidebarVideo.muted = true;
    sidebarVideo.autoplay = true;
    sidebarVideo.playsinline = true;
    sidebarVideo.srcObject = window.screenStream;
    sidebarVideo.classList.add("screen-share");
    
    sidebarVideo.play().catch(e => console.error("Error playing sidebar screen video:", e));
    
    // Create label with display name for sidebar
    const sidebarLabel = document.createElement("div");
    sidebarLabel.classList.add("user-label");
    sidebarLabel.textContent = `Screen: ${window.userDisplayName || "You"}`;
    
    // Clone the screen icon for sidebar
    const sidebarIcon = screenIcon.cloneNode(true);
    
    // Add to DOM
    sidebarContainer.appendChild(sidebarVideo);
    sidebarContainer.appendChild(sidebarLabel);
    sidebarContainer.appendChild(sidebarIcon);
    
    // Add pin button
    import('./video-pin.js').then(module => {
      module.addPinButton(sidebarContainer, "sidebar-local-screen");
    });
    
    // Add to sidebar
    window.participantsSidebar.appendChild(sidebarContainer);
    
    // Also add original container to the grid but hide it
    videoContainer.style.display = 'none';
    import('./video-pin.js').then(module => {
      module.addPinButton(videoContainer, "local-screen");
    });
    window.videosDiv.appendChild(videoContainer);
  } else {
    // Normal mode - add to grid
    import('./video-pin.js').then(module => {
      module.addPinButton(videoContainer, "local-screen");
    });
    window.videosDiv.appendChild(videoContainer);
  }
  
  // Update grid layout
  import('./layout.js').then(module => {
    module.updateGridLayout();
  });
  
  return videoContainer;
}

export {
  startScreenSharing,
  stopScreenSharing,
  shareScreenWithUser,
  createLocalScreenShareContainer
}; 