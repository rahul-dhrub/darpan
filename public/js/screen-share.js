// Module for screen sharing functionality
import { updateGridLayout } from './layout.js';
import { checkAndRestoreVideos } from './layout.js';
import { announceToScreenReaders, addVideoLoadedListener } from './utils.js';
import { unpinVideo } from './video-pin.js';
import { addPinButton } from './video-pin.js';

// Start screen sharing
function startScreenSharing() {
  if (window.screenSharingActive) return;
  
  // Before requesting screen share, make sure we have a valid camera track saved
  if (!window.cameraVideoTrack && window.localStream) {
    const videoTracks = window.localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      window.cameraVideoTrack = videoTracks[0].clone(); // Create a clone to ensure we have a clean copy
    }
  }
  
  navigator.mediaDevices.getDisplayMedia({ 
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 }
    },
    audio: false // Disable audio for screen sharing to prevent echo
  })
    .then(stream => {
      // Run check to make sure videos are still visible
      checkAndRestoreVideos();
      
      // Save the screen stream globally
      window.screenStream = stream;
      window.screenSharingActive = true;
      
      // Create a container for the screen video
      const videoContainer = document.createElement("div");
      videoContainer.id = "local-screen-container";
      videoContainer.classList.add("video-item", "new-screen-share", "screen-share-container");
      
      // Create a local video element for screen preview
      const screenVideo = document.createElement("video");
      screenVideo.id = "local-screen";
      screenVideo.muted = true;
      screenVideo.srcObject = stream;
      screenVideo.autoplay = true;
      screenVideo.play().catch(e => console.error("Error playing screen share:", e));
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
      label.textContent = "Your Screen";
      
      // Append elements
      videoContainer.appendChild(screenVideo);
      videoContainer.appendChild(label);
      videoContainer.appendChild(screenIcon);
      
      // Add pin button and screen share badge
      addPinButton(videoContainer, "local-screen");
      
      // Make sure local video container is still visible during screen sharing
      const localVideoContainer = document.getElementById("container-local");
      if (localVideoContainer) {
        // Ensure it's visible
        localVideoContainer.style.display = '';
      }
      
      // If a video is already pinned, add the screen share to the sidebar
      if (window.pinnedVideoId) {
        const clone = videoContainer.cloneNode(true);
        const cloneVideo = clone.querySelector('video');
        cloneVideo.srcObject = window.screenStream;
        cloneVideo.id = "sidebar-local-screen";
        clone.id = "sidebar-container-local-screen";
        addVideoLoadedListener(cloneVideo);
        
        // Update pin button for sidebar
        addPinButton(clone, "sidebar-local-screen");
        
        window.participantsSidebar.appendChild(clone);
      } else {
        // Add to the grid
        window.videosDiv.appendChild(videoContainer);
        
        // Option to auto-pin screen shares - disabled to avoid issues
        const autoPinScreenShare = false; 
        if (autoPinScreenShare) {
          setTimeout(() => {
            // Add pinning animation
            videoContainer.classList.add('pinning');
            setTimeout(() => {
              videoContainer.classList.remove('pinning');
              pinVideo("local-screen");
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
      
      // Send screen to all connected peers as a separate stream
      Object.keys(window.peers).forEach(userId => {
        shareScreenWithUser(userId);
      });
      
      // Listen for the screen sharing to end
      window.screenStream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
        // Check videos again after stopping
        setTimeout(checkAndRestoreVideos, 1000);
      };
      
      window.screenShareBtn.disabled = true;
      window.screenShareBtn.classList.add('active');
      window.stopScreenShareBtn.disabled = false;
      
      // Announce for screen readers
      announceToScreenReaders("Screen sharing started");
    })
    .catch(error => {
      console.error("Error sharing screen:", error);
    });
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

export {
  startScreenSharing,
  stopScreenSharing,
  shareScreenWithUser
}; 