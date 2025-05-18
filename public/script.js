const socket = io();
const ROOM_ID = "group-room";
const peers = {};
const videosDiv = document.getElementById("videos");
const screenShareBtn = document.getElementById("screenShareBtn");
const stopScreenShareBtn = document.getElementById("stopScreenShareBtn");
const muteBtn = document.getElementById("muteBtn");
const videoBtn = document.getElementById("videoBtn");
const leaveBtn = document.getElementById("leaveBtn");
const chatToggleBtn = document.getElementById("chatToggleBtn");
const chatCollapseBtn = document.getElementById("chatCollapseBtn");
const sidebar = document.getElementById("sidebar");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatMessages = document.getElementById("chatMessages");
const pinnedVideoWrapper = document.getElementById("pinnedVideoWrapper");
const participantsSidebar = document.getElementById("participantsSidebar");
const mainContent = document.querySelector(".main-content");
const meetingTimeElement = document.getElementById("meetingTime");
const participantCountElement = document.getElementById("participantCount");
const headerToggle = document.getElementById("headerToggle");
const controlsToggle = document.getElementById("controlsToggle");
const header = document.querySelector(".header");
const controls = document.querySelector(".controls");
const controlsContainer = document.querySelector(".controls-container");

let localStream;
let screenStream;
let screenSharingPeers = {};
let screenSharingActive = false;
let audioEnabled = true;
let videoEnabled = true;
let chatVisible = false;
let meetingStartTime = Date.now();
let pinnedVideoId = null;
let resizeTimeout = null;
let cameraVideoTrack = null; // Store the original camera video track
let meetingTimerInterval; // For tracking the meeting time
let totalParticipants = 1; // Start with 1 (local user)
let headerCollapsed = false;
let controlsCollapsed = false;

// Advanced audio constraints to reduce echo and noise
const audioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

// Toggle header (navbar) when the toggle button is clicked
headerToggle.addEventListener("click", () => {
  headerCollapsed = !headerCollapsed;
  header.classList.toggle("collapsed", headerCollapsed);
  
  // Update the icon direction
  const icon = headerToggle.querySelector(".material-icons");
  icon.textContent = headerCollapsed ? "expand_less" : "expand_more";
  
  // Position the toggle button
  if (headerCollapsed) {
    headerToggle.style.top = "0px";
  } else {
    // Let it be positioned by CSS
    headerToggle.style.top = "";
  }
  
  // Update videos container height
  updateVideoContainerHeight();
});

// Toggle controls when the toggle button is clicked
controlsToggle.addEventListener("click", () => {
  controlsCollapsed = !controlsCollapsed;
  controls.classList.toggle("collapsed", controlsCollapsed);
  controlsToggle.classList.toggle("collapsed", controlsCollapsed);
  
  // Update the icon direction
  const icon = controlsToggle.querySelector(".material-icons");
  icon.textContent = controlsCollapsed ? "expand_less" : "expand_more";
  
  // Position the toggle button
  if (controlsCollapsed) {
    controlsToggle.style.bottom = "0px";
    // Make sure controls-container doesn't collapse
    if (controlsContainer) {
      controlsContainer.style.height = controlsToggle.offsetHeight + "px";
      controlsContainer.classList.add("collapsed");
    }
  } else {
    // Let it be positioned by CSS
    controlsToggle.style.bottom = "";
    // Reset container height
    if (controlsContainer) {
      controlsContainer.style.height = "";
      controlsContainer.classList.remove("collapsed");
    }
  }
  
  // Update videos container height
  updateVideoContainerHeight();
});

// Update video container height based on header and controls visibility
function updateVideoContainerHeight() {
  // Get the visible height of header and controls
  const headerHeight = headerCollapsed ? 0 : (header.offsetHeight || 0);
  const controlsHeight = controlsCollapsed ? 0 : (controls.offsetHeight || 0);
  
  // Add padding for the header toggle button (it's fixed positioned)
  const topPadding = 30; // Height of the header toggle button
  
  // Calculate new max-height for videos container
  const newHeight = `calc(100vh - ${headerHeight + controlsHeight + topPadding}px)`;
  videosDiv.style.maxHeight = newHeight;
  
  // Add padding to the container for the toggle buttons
  videosDiv.style.paddingTop = headerCollapsed ? `${topPadding}px` : '0';
  // No bottom padding needed as control toggle is now at the right side
  videosDiv.style.paddingBottom = '0';
  
  // Also update pinned video container if in pinned mode
  if (mainContent.classList.contains("pinned-mode")) {
    const pinnedContainer = document.querySelector(".pinned-video-container");
    if (pinnedContainer) {
      pinnedContainer.style.maxHeight = newHeight;
      pinnedContainer.style.paddingTop = headerCollapsed ? `${topPadding}px` : '0';
      pinnedContainer.style.paddingBottom = '0';
    }
  }
  
  // Update grid layout after a short delay to let transitions complete
  setTimeout(updateGridLayout, 300);
}

// Add window resize event listener to update layout
window.addEventListener('resize', () => {
  // Debounce the resize event to avoid excessive updates
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  
  resizeTimeout = setTimeout(() => {
    updateVideoContainerHeight();
    updateGridLayout();
  }, 300);
});

// Call updateVideoContainerHeight once when the page loads
window.addEventListener('load', () => {
  updateVideoContainerHeight();
});

// Improved function to update grid layout
function updateGridLayout() {
  const videoItems = document.querySelectorAll('.video-item:not([style*="display: none"])');
  const participantCount = videoItems.length;
  
  // Remove all grid classes
  videosDiv.classList.forEach(className => {
    if (className.startsWith('grid-')) {
      videosDiv.classList.remove(className);
    }
  });
  
  // Add the appropriate grid class based on participant count
  videosDiv.classList.add(`grid-${participantCount}`);
  
  // Ensure videos are properly spaced and sized
  videoItems.forEach(item => {
    // Reset any inline styles that might affect layout
    item.style.width = '';
    item.style.height = '';
    
    // Make sure videos maintain their aspect ratio
    const video = item.querySelector('video');
    if (video) {
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'contain';
      
      // Ensure video doesn't stretch beyond its natural aspect ratio
      ensureVideoAspectRatio(video);
    }
  });
  
  // Force a small delay to let the browser properly calculate layout
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 10);
}

// Function to ensure video maintains its natural aspect ratio
function ensureVideoAspectRatio(videoElement) {
  if (videoElement.videoWidth && videoElement.videoHeight) {
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    if (Math.abs(aspectRatio - 16/9) > 0.1) {
      // If video's natural aspect ratio is significantly different from 16:9
      // Adjust the container to match the video's natural aspect ratio
      const container = videoElement.parentElement;
      if (container) {
        container.style.aspectRatio = `${videoElement.videoWidth} / ${videoElement.videoHeight}`;
      }
    }
  }
}

// Add event listeners to all videos to ensure aspect ratio is maintained
function addVideoLoadedListener(videoElement) {
  videoElement.addEventListener('loadedmetadata', () => {
    ensureVideoAspectRatio(videoElement);
  });
}

// Start meeting timer
function startMeetingTimer() {
  // Initialize with current time
  updateMeetingTimer();
  
  // Update timer every second
  meetingTimerInterval = setInterval(updateMeetingTimer, 1000);
}

// Update the meeting timer display
function updateMeetingTimer() {
  const elapsedTime = Date.now() - meetingStartTime;
  const seconds = Math.floor((elapsedTime / 1000) % 60);
  const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
  const hours = Math.floor((elapsedTime / (1000 * 60 * 60)));
  
  meetingTimeElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Update participant count in the UI
function updateParticipantCount() {
  participantCountElement.textContent = totalParticipants.toString();
}

// Initialize meeting UI components
function initMeetingUI() {
  startMeetingTimer();
  updateParticipantCount();
}

// Create a wrapper for the local video
navigator.mediaDevices.getUserMedia({ 
  video: true, 
  audio: audioConstraints 
}).then(stream => {
  localStream = stream;
  
  // Initialize meeting UI elements
  initMeetingUI();
  
  // Save the original camera video track for reference
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length > 0) {
    cameraVideoTrack = videoTracks[0];
  }
  
  // Create a container for the video
  const videoContainer = document.createElement("div");
  videoContainer.classList.add("video-item");
  videoContainer.id = "container-local";
  
  // Create the video element
  localVideo = document.createElement("video");
  localVideo.muted = true;
  localVideo.playsinline = true;
  localVideo.srcObject = stream;
  localVideo.play();
  localVideo.classList.add("local-video");
  localVideo.id = "local";
  
  // Add aspect ratio listener
  addVideoLoadedListener(localVideo);
  
  // Create local video controls to replace the "You" label
  const localControls = document.createElement("div");
  localControls.classList.add("local-controls");
  
  // Create mic toggle button
  const localMicBtn = document.createElement('button');
  localMicBtn.classList.add('local-control-btn');
  localMicBtn.innerHTML = '<span class="material-icons">mic</span>';
  localMicBtn.title = 'Toggle microphone';
  localMicBtn.addEventListener('click', () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioEnabled = !audioEnabled;
        audioTracks[0].enabled = audioEnabled;
        muteBtn.innerHTML = audioEnabled ? 
          '<span class="material-icons control-icon">mic</span><span class="control-text">Mute</span>' : 
          '<span class="material-icons control-icon">mic_off</span><span class="control-text">Unmute</span>';
        muteBtn.classList.toggle('active', !audioEnabled);
        localMicBtn.innerHTML = audioEnabled ? 
          '<span class="material-icons">mic</span>' : 
          '<span class="material-icons">mic_off</span>';
        
        // Update status indicators
        updatePeerMicStatus('local', audioEnabled);
        
        // Emit status change to others
        socket.emit("mic-status-change", {
          room: ROOM_ID,
          isOn: audioEnabled
        });
      }
    }
  });
  
  // Create camera toggle button
  const localVideoBtn = document.createElement('button');
  localVideoBtn.classList.add('local-control-btn');
  localVideoBtn.innerHTML = '<span class="material-icons">videocam</span>';
  localVideoBtn.title = 'Toggle camera';
  localVideoBtn.addEventListener('click', () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoEnabled = !videoEnabled;
        videoTracks[0].enabled = videoEnabled;
        videoBtn.innerHTML = videoEnabled ? 
          '<span class="material-icons control-icon">videocam</span><span class="control-text">Stop Video</span>' : 
          '<span class="material-icons control-icon">videocam_off</span><span class="control-text">Start Video</span>';
        videoBtn.classList.toggle('active', !videoEnabled);
        localVideoBtn.innerHTML = videoEnabled ? 
          '<span class="material-icons">videocam</span>' : 
          '<span class="material-icons">videocam_off</span>';
        
        // Update status indicators
        updatePeerVideoStatus('local', videoEnabled);
        
        // Emit status change to others
        socket.emit("video-status-change", {
          room: ROOM_ID,
          isOn: videoEnabled
        });
      }
    }
  });
  
  // Add buttons to local controls
  localControls.appendChild(localMicBtn);
  localControls.appendChild(localVideoBtn);
  
  // Append elements
  videoContainer.appendChild(localVideo);
  videoContainer.appendChild(localControls);
  
  // Add pin button with tooltip
  addPinButton(videoContainer, "local");
  
  // Add status indicators
  addStatusIndicators(videoContainer, 'local');
  updatePeerMicStatus('local', audioEnabled);
  updatePeerVideoStatus('local', videoEnabled);
  
  videosDiv.appendChild(videoContainer);
  
  // Update grid layout
  updateGridLayout();

  socket.emit("join-room", ROOM_ID);

  // Audio mute toggle
  muteBtn.addEventListener("click", () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioEnabled = !audioEnabled;
        audioTracks[0].enabled = audioEnabled;
        muteBtn.innerHTML = audioEnabled ? 
          '<span class="material-icons control-icon">mic</span><span class="control-text">Mute</span>' : 
          '<span class="material-icons control-icon">mic_off</span><span class="control-text">Unmute</span>';
        muteBtn.classList.toggle('active', !audioEnabled);
        
        // Update local indicators
        updatePeerMicStatus('local', audioEnabled);
        
        // Emit status change to peers with proper userId
        socket.emit("mic-status-change", {
          room: ROOM_ID,
          userId: 'local',
          isOn: audioEnabled
        });
      }
    }
  });
});

// Video toggle
videoBtn.addEventListener("click", () => {
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      videoEnabled = !videoEnabled;
      videoTracks[0].enabled = videoEnabled;
      videoBtn.innerHTML = videoEnabled ? 
        '<span class="material-icons control-icon">videocam</span><span class="control-text">Stop Video</span>' : 
        '<span class="material-icons control-icon">videocam_off</span><span class="control-text">Start Video</span>';
      videoBtn.classList.toggle('active', !videoEnabled);
      
      // Update local indicators
      updatePeerVideoStatus('local', videoEnabled);
      
      // Emit status change to peers with proper userId
      socket.emit("video-status-change", {
        room: ROOM_ID,
        userId: 'local',
        isOn: videoEnabled
      });
    }
  }
});

// Leave meeting
leaveBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to leave the meeting?")) {
    // Calculate meeting duration in seconds
    const meetingDuration = Math.floor((Date.now() - meetingStartTime) / 1000);
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenSharingActive) {
      stopScreenSharing();
    }
    socket.disconnect();
    
    // Redirect to rating page with meeting duration
    window.location.href = `/rating.html?duration=${meetingDuration}`;
  }
});

// Toggle chat sidebar
chatToggleBtn.addEventListener("click", () => {
  chatVisible = !chatVisible;
  sidebar.classList.toggle("sidebar-hidden", !chatVisible);
  chatToggleBtn.classList.toggle('active', chatVisible);
});

// Collapse chat sidebar from within
chatCollapseBtn.addEventListener("click", () => {
  chatVisible = false;
  sidebar.classList.add("sidebar-hidden");
  chatToggleBtn.classList.remove('active');
});

// Chat functionality
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const message = chatInput.value.trim();
  if (message) {
    socket.emit("chat-message", {
      room: ROOM_ID,
      message,
      sender: socket.id
    });
    
    addMessage(message, "You", true);
    chatInput.value = "";
  }
}

function addMessage(message, sender, isSent) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", isSent ? "message-sent" : "message-received");
  
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  messageElement.innerHTML = `
    ${message}
    <span class="message-meta">${sender} · ${time}</span>
  `;
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // If chat is not visible, highlight the chat button
  if (!chatVisible) {
    chatToggleBtn.classList.add("active");
  }
}

socket.on("chat-message", ({ message, sender, senderName }) => {
  addMessage(message, senderName || "User", false);
});

socket.on("user-connected", userId => {
  console.log('User connected: ' + userId);
  
  // Update participant count
  totalParticipants++;
  updateParticipantCount();
  
  const peer = createPeer(userId);
  peers[userId] = peer;

  localStream.getTracks().forEach(track => {
    peer.addTrack(track, localStream);
  });

  peer.createOffer().then(offer => {
    peer.setLocalDescription(offer);
    socket.emit("offer", { to: userId, offer });
  });

  // If we are currently sharing screen, also share with the new user
  if (screenSharingActive && screenStream) {
    shareScreenWithUser(userId);
  }
});

socket.on("offer", ({ from, offer, isScreenShare }) => {
  let peer;
  
  if (isScreenShare) {
    // This is a screen sharing offer
    peer = createScreenPeer(from);
    screenSharingPeers[from] = peer;
  } else {
    // This is a regular video offer
    peer = createPeer(from);
    peers[from] = peer;
    
    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
    });
  }

  peer.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
    return peer.createAnswer();
  }).then(answer => {
    peer.setLocalDescription(answer);
    socket.emit("answer", { 
      to: from, 
      answer,
      isScreenShare 
    });
  });
});

socket.on("answer", ({ from, answer, isScreenShare }) => {
  if (isScreenShare && screenSharingPeers[from]) {
    screenSharingPeers[from].setRemoteDescription(new RTCSessionDescription(answer));
  } else if (!isScreenShare && peers[from]) {
    peers[from].setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on("ice-candidate", ({ from, candidate, isScreenShare }) => {
  if (isScreenShare && screenSharingPeers[from]) {
    screenSharingPeers[from].addIceCandidate(new RTCIceCandidate(candidate));
  } else if (!isScreenShare && peers[from]) {
    peers[from].addIceCandidate(new RTCIceCandidate(candidate));
  }
});

socket.on("user-disconnected", userId => {
  console.log('User disconnected: ' + userId);
  
  // Update participant count
  if (totalParticipants > 1) {
    totalParticipants--;
    updateParticipantCount();
  }
  
  // Check if the disconnected user was pinned
  if (pinnedVideoId === userId || pinnedVideoId === `screen-${userId}`) {
    unpinVideo();
  }
  
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }
  if (screenSharingPeers[userId]) {
    screenSharingPeers[userId].close();
    delete screenSharingPeers[userId];
  }

  // Remove video container
  const videoContainer = document.getElementById(`container-${userId}`);
  if (videoContainer) {
    videoContainer.remove();
    // Update grid layout
    updateGridLayout();
  }
  
  // Remove screen share container
  const screenContainer = document.getElementById(`screen-container-${userId}`);
  if (screenContainer) {
    screenContainer.remove();
    // Update grid layout
    updateGridLayout();
  }
});

// Add new event handler for when a user stops screen sharing
socket.on("user-stopped-screen-sharing", userId => {
  // Check if the stopped screen share was pinned
  if (pinnedVideoId === `screen-${userId}`) {
    unpinVideo();
  }
  
  if (screenSharingPeers[userId]) {
    screenSharingPeers[userId].close();
    delete screenSharingPeers[userId];
  }
  
  // Remove screen container
  const screenContainer = document.getElementById(`screen-container-${userId}`);
  if (screenContainer) {
    screenContainer.remove();
    // Update grid layout
    updateGridLayout();
  }
});

// Add function to handle pinning and unpinning videos
function togglePinVideo(videoId) {
  // Check if this is a sidebar video (videoId will start with 'sidebar-')
  const isSidebarVideo = videoId.startsWith('sidebar-');
  
  // If it's a sidebar video, we need to get the real video ID
  const actualVideoId = isSidebarVideo ? videoId.substring(8) : videoId;
  
  if (pinnedVideoId === actualVideoId) {
    // Unpin the current video
    unpinVideo();
  } else {
    // Find the container for animation based on actual ID
    let containerId;
    
    if (isSidebarVideo) {
      // For sidebar videos, we need to find the original container
      const sidebarContainer = document.getElementById(`sidebar-container-${actualVideoId}`);
      if (sidebarContainer) {
        // Add the pinning class to the sidebar container for visual feedback
        sidebarContainer.classList.add('pinning');
        // Remove after animation
        setTimeout(() => {
          sidebarContainer.classList.remove('pinning');
        }, 300);
      }
      
      // Use the actual video ID to get the main container
      containerId = actualVideoId.startsWith('screen-') 
        ? `screen-container-${actualVideoId.substring(7)}` 
        : `container-${actualVideoId}`;
    } else {
      // Regular case - not from sidebar
      containerId = actualVideoId.startsWith('screen-') 
        ? `screen-container-${actualVideoId.substring(7)}` 
        : `container-${actualVideoId}`;
    }
    
    const container = document.getElementById(containerId);
    if (container) {
      // Add animation class to the main container if visible
      if (container.style.display !== 'none') {
        container.classList.add('pinning');
        
        // Remove class after animation
        setTimeout(() => {
          container.classList.remove('pinning');
          // Pin the video after visual feedback
          pinVideo(actualVideoId);
        }, 300);
      } else {
        // Container is hidden, just pin immediately
        pinVideo(actualVideoId);
      }
    } else {
      // No container found, just pin immediately
      pinVideo(actualVideoId);
    }
  }
}

// Add swap buttons for quickly switching between pinned views
function addSwapViewButtons(pinnedContainer) {
  // Create the swap buttons container
  const swapButtonsContainer = document.createElement('div');
  swapButtonsContainer.classList.add('swap-view-buttons');
  
  // Previous button
  const prevButton = document.createElement('button');
  prevButton.classList.add('swap-view-button');
  prevButton.innerHTML = '<span class="material-icons">arrow_back_ios</span>';
  prevButton.title = 'Previous participant';
  prevButton.addEventListener('click', () => {
    swapPinnedView('prev');
  });
  
  // Next button
  const nextButton = document.createElement('button');
  nextButton.classList.add('swap-view-button');
  nextButton.innerHTML = '<span class="material-icons">arrow_forward_ios</span>';
  nextButton.title = 'Next participant';
  nextButton.addEventListener('click', () => {
    swapPinnedView('next');
  });
  
  // Add buttons to container
  swapButtonsContainer.appendChild(prevButton);
  swapButtonsContainer.appendChild(nextButton);
  
  // Add to the pinned container
  pinnedContainer.appendChild(swapButtonsContainer);
}

// Function to swap between pinned views
function swapPinnedView(direction) {
  if (!pinnedVideoId) return;
  
  // Get all sidebar videos
  const sidebarVideos = Array.from(participantsSidebar.querySelectorAll('.video-item'));
  if (sidebarVideos.length === 0) return;
  
  // Get all pinnable IDs from sidebar videos
  const pinnableIds = sidebarVideos.map(item => {
    const videoElem = item.querySelector('video');
    if (!videoElem) return null;
    
    const videoId = videoElem.id;
    if (!videoId) return null;
    
    // Remove 'sidebar-' prefix to get the original ID
    return videoId.startsWith('sidebar-') ? videoId.substring(8) : videoId;
  }).filter(id => id !== null);
  
  if (pinnableIds.length === 0) return;
  
  // Find the currently pinned video's index
  let currentIndex = -1;
  
  // First check if it's a screen share
  if (pinnedVideoId.startsWith('screen-') || pinnedVideoId === 'local-screen') {
    // For screen shares
    currentIndex = pinnableIds.findIndex(id => 
      id === pinnedVideoId || 
      id === pinnedVideoId.replace('screen-', '')
    );
  } else {
    // For regular videos
    currentIndex = pinnableIds.findIndex(id => id === pinnedVideoId);
  }
  
  if (currentIndex === -1) {
    // If not found, start from beginning or end
    currentIndex = direction === 'next' ? -1 : pinnableIds.length;
  }
  
  // Calculate the new index
  let newIndex;
  if (direction === 'next') {
    newIndex = (currentIndex + 1) % pinnableIds.length;
  } else {
    newIndex = (currentIndex - 1 + pinnableIds.length) % pinnableIds.length;
  }
  
  // Get the new ID to pin
  const newPinId = pinnableIds[newIndex];
  
  // Unpin current and pin the new one
  unpinVideo();
  
  // Add pinning animation to the video we're about to pin
  const containerId = newPinId.startsWith('screen-') 
    ? `screen-container-${newPinId.substring(7)}` 
    : `container-${newPinId}`;
  
  const container = document.getElementById(containerId);
  if (container) {
    container.classList.add('pinning');
    setTimeout(() => {
      container.classList.remove('pinning');
      pinVideo(newPinId);
    }, 300);
  } else {
    // Container not found, just pin directly
    pinVideo(newPinId);
  }
}

// Update pinVideo function to add swap buttons
function pinVideo(videoId) {
  // Handle the previously pinned video first if there is one
  const previouslyPinnedId = pinnedVideoId;
  
  if (previouslyPinnedId && previouslyPinnedId !== videoId) {
    // We need to swap the videos - move previously pinned to sidebar and pin the new one
    
    // Get the previously pinned video element and details
    const previousPinnedElem = document.getElementById(`pinned-${previouslyPinnedId}`);
    if (previousPinnedElem && previousPinnedElem.srcObject) {
      // We have a valid previous pinned video
      
      // Find the original container for the previously pinned video
      const prevOrigContainerId = previouslyPinnedId.startsWith('screen-') 
        ? `screen-container-${previouslyPinnedId.substring(7)}` 
        : `container-${previouslyPinnedId}`;
      
      const prevOrigContainer = document.getElementById(prevOrigContainerId);
      
      if (prevOrigContainer) {
        // Show the original container again for when we unpin
        prevOrigContainer.style.display = '';
        
        // Ensure its video element has the stream
        const prevOrigVideo = prevOrigContainer.querySelector('video');
        if (prevOrigVideo) {
          prevOrigVideo.srcObject = previousPinnedElem.srcObject;
        }
      }
    }
  }
  
  // Now continue with pinning the new video
  
  // Enable pinned mode
  mainContent.classList.add('pinned-mode');
  pinnedVideoId = videoId;
  
  // Check if this is a screen share
  const isScreenShare = videoId === 'local-screen' || videoId.startsWith('screen-');
  const isLocalScreenShare = videoId === 'local-screen';
  
  // Get the original video element to access its stream
  const originalVideoId = videoId.startsWith('screen-') ? videoId : videoId;
  const originalVideo = document.getElementById(originalVideoId);
  
  if (!originalVideo || !originalVideo.srcObject) {
    console.error("Cannot pin video: source not found");
    return;
  }
  
  // Get the source stream
  const stream = originalVideo.srcObject;
  
  // For local screen share, make sure we save the stream for when we unpin
  if (isLocalScreenShare) {
    screenStream = stream;
  }
  
  // Find the container
  const videoContainer = document.getElementById(
    videoId.startsWith('screen-') ? `screen-container-${videoId.substring(7)}` : `container-${videoId}`
  );
  
  if (videoContainer) {
    // Create a new container for the pinned video
    const pinnedContainer = document.createElement('div');
    pinnedContainer.id = `pinned-${videoContainer.id}`;
    pinnedContainer.classList.add('video-item');
    
    // If it's a screen share, add the screen share container class
    if (isScreenShare) {
      pinnedContainer.classList.add('screen-share-container', 'pinned-screen-share');
    }
    
    // Create a new video element
    const pinnedVideo = document.createElement('video');
    pinnedVideo.id = `pinned-${originalVideoId}`;
    pinnedVideo.autoplay = true;
    pinnedVideo.playsinline = true;
    
    // Important: Set srcObject before appending to DOM to avoid blank video
    pinnedVideo.srcObject = stream;
    
    // Add aspect ratio listener
    addVideoLoadedListener(pinnedVideo);
    
    // If the original was the local video, mute it
    if (videoId === 'local') {
      pinnedVideo.muted = true;
    }
    
    // If the original was a screen share, add the class
    if (isScreenShare) {
      pinnedVideo.classList.add('screen-share');
      
      // Add screen share icon
      const screenIcon = document.createElement("div");
      screenIcon.classList.add("screen-share-icon");
      screenIcon.innerHTML = '<span class="material-icons">screen_share</span>';
      pinnedContainer.appendChild(screenIcon);
    }
    
    // Copy the label
    const originalLabel = videoContainer.querySelector('.user-label');
    const label = document.createElement('div');
    label.classList.add('user-label');
    label.textContent = originalLabel ? originalLabel.textContent : (isScreenShare ? 'Screen Share' : 'Video');
    
    // Add pinned badge
    const pinnedBadge = document.createElement("div");
    pinnedBadge.classList.add("pinned-badge");
    pinnedBadge.textContent = "Pinned";
    
    // Append elements
    pinnedContainer.appendChild(pinnedVideo);
    pinnedContainer.appendChild(label);
    pinnedContainer.appendChild(pinnedBadge);
    
    // Add unpin button
    addPinButton(pinnedContainer, videoId, true);
    
    // Add swap view buttons if we have more than one participant
    const otherParticipantsExist = document.querySelectorAll('.videos-container .video-item').length > 1;
    if (otherParticipantsExist) {
      addSwapViewButtons(pinnedContainer);
    }
    
    // Clear any previous pinned video
    pinnedVideoWrapper.innerHTML = '';
    pinnedVideoWrapper.appendChild(pinnedContainer);
    
    // Play the video
    pinnedVideo.play().catch(e => console.error("Error playing pinned video:", e));
    
    // Hide the original container
    videoContainer.style.display = 'none';
    
    // Move all other videos to the sidebar, including previously pinned
    moveOtherVideosToSidebar(videoId);
    
    // Announce pin action for screen readers (accessibility)
    const announceMsg = `${isScreenShare ? 'Screen share' : 'Video'} has been pinned`;
    announceToScreenReaders(announceMsg);
  }
}

// Unpin the current video
function unpinVideo() {
  if (!pinnedVideoId) return;
  
  // Save pinned ID before resetting it
  const prevPinnedId = pinnedVideoId;
  const isLocalScreenShare = prevPinnedId === "local-screen";
  
  // If we're unpinning local screen share, make sure we save the stream
  if (isLocalScreenShare) {
    const pinnedVideo = document.getElementById(`pinned-${prevPinnedId}`);
    if (pinnedVideo && pinnedVideo.srcObject && (!screenStream || !screenStream.active)) {
      console.log("Saving screen stream from pinned video");
      screenStream = pinnedVideo.srcObject;
    }
  }
  
  // Find the original container
  const videoId = pinnedVideoId;
  const originalContainerId = videoId.startsWith('screen-') 
    ? `screen-container-${videoId.substring(7)}` 
    : `container-${videoId}`;
  
  const originalContainer = document.getElementById(originalContainerId);
  if (originalContainer) {
    // Show the original container
    originalContainer.style.display = '';
    
    // Make sure the original video has the stream from the pinned video
    const pinnedVideo = document.getElementById(`pinned-${videoId}`);
    const originalVideo = originalContainer.querySelector('video');
    
    if (pinnedVideo && pinnedVideo.srcObject && originalVideo) {
      originalVideo.srcObject = pinnedVideo.srcObject;
      originalVideo.play().catch(e => console.error("Error playing unpinned video:", e));
    }
  }
  
  // Reset pinned video
  pinnedVideoId = null;
  pinnedVideoWrapper.innerHTML = '';
  
  // Show all hidden video containers that might have been moved to sidebar
  const hiddenContainers = document.querySelectorAll('.videos-container .video-item[style*="display: none"]');
  hiddenContainers.forEach(container => {
    container.style.display = '';
    container.dataset.inSidebar = '';
    
    // Make sure all videos in these containers are playing
    const video = container.querySelector('video');
    if (video && video.srcObject) {
      video.play().catch(e => console.error("Error playing restored video:", e));
    }
  });
  
  // Move all videos back to the grid and update layout
  moveAllVideosToGrid();
  
  // Disable pinned mode
  mainContent.classList.remove('pinned-mode');
  
  // Force visibility check - use a slightly longer delay for local screen share
  setTimeout(() => {
    // Check for any videos that might still be hidden
    checkAndRestoreVideos();
    // Update grid layout
    updateGridLayout();
  }, isLocalScreenShare ? 150 : 100);
  
  // Announce for screen readers
  announceToScreenReaders("Video unpinned");
}

// Add a function to handle the sidebar header with video filters
function updateSidebarHeader(videoCount, screenShareCount) {
  // Clear existing header
  const existingHeader = participantsSidebar.querySelector('.sidebar-header');
  if (existingHeader) {
    existingHeader.remove();
  }
  
  if (videoCount + screenShareCount === 0) {
    // No videos to show
    const emptyMessage = document.createElement('div');
    emptyMessage.classList.add('empty-sidebar-message');
    emptyMessage.textContent = 'No other participants';
    
    // Add to the beginning of sidebar
    if (participantsSidebar.firstChild) {
      participantsSidebar.insertBefore(emptyMessage, participantsSidebar.firstChild);
    } else {
      participantsSidebar.appendChild(emptyMessage);
    }
    return;
  }
  
  // Create header container
  const header = document.createElement('div');
  header.classList.add('sidebar-header');
  
  // Create participant count text
  const countText = document.createElement('span');
  countText.textContent = `${videoCount + screenShareCount} other participant${videoCount + screenShareCount !== 1 ? 's' : ''}`;
  header.appendChild(countText);
  
  // If there are screen shares, add filter options
  if (screenShareCount > 0) {
    // Create filter container
    const filterContainer = document.createElement('div');
    filterContainer.classList.add('sidebar-filters');
    
    // Add a separator
    const separator = document.createElement('span');
    separator.classList.add('sidebar-separator');
    separator.textContent = ' | ';
    filterContainer.appendChild(separator);
    
    // Add "All" filter
    const allFilter = document.createElement('button');
    allFilter.classList.add('sidebar-filter', 'active');
    allFilter.textContent = 'All';
    allFilter.dataset.filter = 'all';
    filterContainer.appendChild(allFilter);
    
    // Add "Videos" filter
    const videosFilter = document.createElement('button');
    videosFilter.classList.add('sidebar-filter');
    videosFilter.textContent = 'Videos';
    videosFilter.dataset.filter = 'videos';
    filterContainer.appendChild(videosFilter);
    
    // Add "Screens" filter
    const screensFilter = document.createElement('button');
    screensFilter.classList.add('sidebar-filter');
    screensFilter.textContent = 'Screens';
    screensFilter.dataset.filter = 'screens';
    filterContainer.appendChild(screensFilter);
    
    // Add click handlers
    [allFilter, videosFilter, screensFilter].forEach(filter => {
      filter.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.sidebar-filter').forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        
        // Apply filtering
        const filterType = filter.dataset.filter;
        
        // Get all sidebar videos
        const videoItems = participantsSidebar.querySelectorAll('.video-item');
        videoItems.forEach(item => {
          const isScreenShare = item.classList.contains('screen-share-container') || 
                               item.querySelector('.screen-share') !== null;
          
          if (filterType === 'all') {
            item.style.display = '';
          } else if (filterType === 'videos' && !isScreenShare) {
            item.style.display = '';
          } else if (filterType === 'screens' && isScreenShare) {
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
    
    header.appendChild(filterContainer);
  }
  
  // Insert at the beginning of sidebar
  if (participantsSidebar.firstChild) {
    participantsSidebar.insertBefore(header, participantsSidebar.firstChild);
  } else {
    participantsSidebar.appendChild(header);
  }
}

// Move other videos to sidebar, including the previously pinned video if there was one
function moveOtherVideosToSidebar(excludeVideoId) {
  // Clear sidebar first
  participantsSidebar.innerHTML = '';
  
  // Track count of videos and screen shares moved to sidebar
  let videoCount = 0;
  let screenShareCount = 0;
  
  // Get all video containers from the grid
  const videoContainers = Array.from(document.querySelectorAll('.videos-container .video-item'));
  
  // Process visible containers first (standard videos)
  videoContainers.forEach(container => {
    // Skip hidden containers (like the currently pinned one)
    if (container.style.display === 'none') return;
    
    const videoElement = container.querySelector('video');
    if (!videoElement || !videoElement.srcObject) return;
    
    const videoId = videoElement.id;
    if (videoId === excludeVideoId) return;
    
    // Check if this is a screen share
    const isScreenShare = container.classList.contains('screen-share-container') || 
                          videoElement.classList.contains('screen-share');
    
    // Create sidebar element for this video
    createSidebarVideo(container, videoElement, videoId);
    
    // Increment appropriate counter
    if (isScreenShare) {
      screenShareCount++;
    } else {
      videoCount++;
    }
  });
  
  // Process previously pinned videos that are now hidden containers
  videoContainers.forEach(container => {
    // Only process hidden containers with videos
    if (container.style.display !== 'none') return;
    
    const videoElement = container.querySelector('video');
    if (!videoElement || !videoElement.srcObject) return;
    
    const videoId = videoElement.id;
    if (videoId === excludeVideoId) return;
    
    // Check if this is a screen share
    const isScreenShare = container.classList.contains('screen-share-container') || 
                          videoElement.classList.contains('screen-share');
    
    // Create sidebar element for this video
    createSidebarVideo(container, videoElement, videoId);
    
    // Increment appropriate counter
    if (isScreenShare) {
      screenShareCount++;
    } else {
      videoCount++;
    }
    
    // Mark that this hidden container is now represented in the sidebar
    container.dataset.inSidebar = 'true';
  });
  
  // Add header with video filters
  updateSidebarHeader(videoCount, screenShareCount);
  
  // Function to create a sidebar video element
  function createSidebarVideo(container, videoElement, videoId) {
    // Create a new container for the sidebar
    const sidebarContainer = document.createElement('div');
    sidebarContainer.classList.add('video-item');
    sidebarContainer.id = `sidebar-${container.id}`;
    
    // Check if this is a screen share
    const isScreenShare = container.classList.contains('screen-share-container') || 
                          videoElement.classList.contains('screen-share');
    
    // Add screen share container class if needed
    if (isScreenShare) {
      sidebarContainer.classList.add('screen-share-container');
    }
    
    // Create a new video element
    const sidebarVideo = document.createElement('video');
    sidebarVideo.id = `sidebar-${videoId}`;
    sidebarVideo.autoplay = true;
    sidebarVideo.playsinline = true;
    
    // Important: Set srcObject before appending to DOM
    sidebarVideo.srcObject = videoElement.srcObject;
    
    // Add aspect ratio listener
    addVideoLoadedListener(sidebarVideo);
    
    // If the original was the local video, mute it
    if (videoId === 'local') {
      sidebarVideo.muted = true;
    }
    
    // If the original was a screen share, add the class
    if (isScreenShare) {
      sidebarVideo.classList.add('screen-share');
      
      // Add screen share icon if not already present
      if (!container.querySelector('.screen-share-icon')) {
        const screenIcon = document.createElement("div");
        screenIcon.classList.add("screen-share-icon");
        screenIcon.innerHTML = '<span class="material-icons">screen_share</span>';
        sidebarContainer.appendChild(screenIcon);
      }
    }
    
    // Copy the label
    const originalLabel = container.querySelector('.user-label');
    const label = document.createElement('div');
    label.classList.add('user-label');
    label.textContent = originalLabel ? originalLabel.textContent : 'Video';
    
    // Append elements
    sidebarContainer.appendChild(sidebarVideo);
    sidebarContainer.appendChild(label);
    
    // Add pin button to each video
    addPinButton(sidebarContainer, `sidebar-${videoId}`);
    
    // Add to sidebar
    participantsSidebar.appendChild(sidebarContainer);
    
    // Play the video
    sidebarVideo.play().catch(e => console.error("Error playing sidebar video:", e));
  }
}

// Move all videos back to the grid
function moveAllVideosToGrid() {
  // Remove all cloned videos from the sidebar
  participantsSidebar.innerHTML = '';
  
  // Ensure all containers in the grid are visible
  const allContainers = document.querySelectorAll('.videos-container .video-item');
  allContainers.forEach(container => {
    container.style.display = '';
    
    // Make sure videos are playing
    const video = container.querySelector('video');
    if (video && video.srcObject) {
      video.play().catch(e => console.error("Error playing video in grid:", e));
    }
  });
  
  // Check if we need to recreate the local screen share container
  if (screenSharingActive && !document.getElementById("local-screen-container")) {
    console.log("Recreating missing local screen share container in grid");
    
    // Create a container for the screen video
    const videoContainer = document.createElement("div");
    videoContainer.id = "local-screen-container";
    videoContainer.classList.add("video-item", "screen-share-container");
    
    // Create a local video element for screen preview
    const screenVideo = document.createElement("video");
    screenVideo.id = "local-screen";
    screenVideo.muted = true;
    screenVideo.srcObject = screenStream;
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
    label.textContent = "Your Screen";
    
    // Append elements
    videoContainer.appendChild(screenVideo);
    videoContainer.appendChild(label);
    videoContainer.appendChild(screenIcon);
    
    // Add pin button and screen share badge
    addPinButton(videoContainer, "local-screen");
    
    // Add to grid
    videosDiv.appendChild(videoContainer);
    
    console.log("Local screen share container successfully added to grid");
  }
  
  // Make sure to call updateGridLayout to refresh the grid
  setTimeout(() => {
    updateGridLayout();
  }, 50);
}

// Add pin button to a video container
function addPinButton(container, videoId, isPinned = false) {
  // Remove any existing pin buttons
  const existingButtons = container.querySelectorAll('.pin-button');
  existingButtons.forEach(btn => btn.remove());
  
  // Get the actual videoId if this is a sidebar video
  const isSidebarVideo = videoId.startsWith('sidebar-');
  const actualVideoId = isSidebarVideo ? videoId.substring(8) : videoId;
  
  // Create new pin button
  const pinButton = document.createElement('button');
  pinButton.classList.add('pin-button');
  pinButton.innerHTML = `<span class="material-icons">${isPinned ? 'push_pin' : 'push_pin'}</span>`;
  pinButton.title = isPinned ? 'Unpin video' : 'Pin video';
  
  pinButton.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePinVideo(videoId); // Pass the original videoId (including sidebar- prefix if present)
  });
  
  // Add screen share badge if this is a screen share
  if (actualVideoId === 'local-screen' || actualVideoId.startsWith('screen-')) {
    // Remove any existing screen share badges
    const existingBadges = container.querySelectorAll('.screen-share-badge');
    existingBadges.forEach(badge => badge.remove());
    
    // Add screen share badge
    const screenShareBadge = document.createElement('div');
    screenShareBadge.classList.add('screen-share-badge');
    screenShareBadge.textContent = 'Screen';
    container.appendChild(screenShareBadge);
  }
  
  // Add tooltip for more information
  const isScreenShare = actualVideoId === 'local-screen' || actualVideoId.startsWith('screen-');
  const tooltipText = isScreenShare ? 
    (actualVideoId === 'local-screen' ? 'Your screen share' : 'Remote screen share') : 
    (actualVideoId === 'local' ? 'Your video' : 'Remote participant');
  
  const tooltip = document.createElement('div');
  tooltip.classList.add('video-tooltip');
  tooltip.textContent = tooltipText;
  container.appendChild(tooltip);
  
  // Add pin instruction tooltip
  if (!isPinned) {
    const pinTooltip = document.createElement('div');
    pinTooltip.classList.add('pin-tooltip');
    pinTooltip.textContent = isScreenShare ? 'Click pin to enlarge screen' : 'Click pin to enlarge video';
    container.appendChild(pinTooltip);
  }
  
  container.appendChild(pinButton);
}

// Function to create peer status indicators
function createPeerStatusIndicators(container, userId) {
  // Create status indicators container
  const statusContainer = document.createElement('div');
  statusContainer.classList.add('peer-status-indicators');
  statusContainer.id = `status-${userId}`;
  
  // Create mic indicator
  const micIndicator = document.createElement('div');
  micIndicator.classList.add('status-indicator', 'mic-status');
  micIndicator.innerHTML = '<span class="material-icons">mic</span>';
  micIndicator.title = 'Microphone is on';
  micIndicator.id = `mic-${userId}`;
  
  // Create video indicator
  const videoIndicator = document.createElement('div');
  videoIndicator.classList.add('status-indicator', 'video-status');
  videoIndicator.innerHTML = '<span class="material-icons">videocam</span>';
  videoIndicator.title = 'Camera is on';
  videoIndicator.id = `video-${userId}`;
  
  // Add to status container
  statusContainer.appendChild(micIndicator);
  statusContainer.appendChild(videoIndicator);
  
  // Add to video container
  container.appendChild(statusContainer);
  
  // Set default status (assumed on until told otherwise)
  updatePeerMicStatus(userId, true);
  updatePeerVideoStatus(userId, true);
}

// Function to update peer's mic status
function updatePeerMicStatus(userId, isOn) {
  // Update main container status
  const micIndicator = document.getElementById(`mic-${userId}`);
  if (micIndicator) {
    if (isOn) {
      micIndicator.innerHTML = '<span class="material-icons">mic</span>';
      micIndicator.classList.remove('status-off');
      micIndicator.title = 'Microphone is on';
    } else {
      micIndicator.innerHTML = '<span class="material-icons">mic_off</span>';
      micIndicator.classList.add('status-off');
      micIndicator.title = 'Microphone is off';
    }
  }
  
  // Also update in sidebar if exists
  const sidebarMicIndicator = document.getElementById(`mic-sidebar-${userId}`);
  if (sidebarMicIndicator) {
    if (isOn) {
      sidebarMicIndicator.innerHTML = '<span class="material-icons">mic</span>';
      sidebarMicIndicator.classList.remove('status-off');
      sidebarMicIndicator.title = 'Microphone is on';
    } else {
      sidebarMicIndicator.innerHTML = '<span class="material-icons">mic_off</span>';
      sidebarMicIndicator.classList.add('status-off');
      sidebarMicIndicator.title = 'Microphone is off';
    }
  }
  
  // Also check for the sidebar container
  const sidebarContainer = document.getElementById(`sidebar-container-${userId}`);
  if (sidebarContainer) {
    const sidebarMic = sidebarContainer.querySelector('.mic-status');
    if (sidebarMic) {
      if (isOn) {
        sidebarMic.innerHTML = '<span class="material-icons">mic</span>';
        sidebarMic.classList.remove('status-off');
        sidebarMic.title = 'Microphone is on';
      } else {
        sidebarMic.innerHTML = '<span class="material-icons">mic_off</span>';
        sidebarMic.classList.add('status-off');
        sidebarMic.title = 'Microphone is off';
      }
    }
  }
}

// Function to update peer's video status
function updatePeerVideoStatus(userId, isOn) {
  // Update main container status
  const videoIndicator = document.getElementById(`video-${userId}`);
  if (videoIndicator) {
    if (isOn) {
      videoIndicator.innerHTML = '<span class="material-icons">videocam</span>';
      videoIndicator.classList.remove('status-off');
      videoIndicator.title = 'Camera is on';
    } else {
      videoIndicator.innerHTML = '<span class="material-icons">videocam_off</span>';
      videoIndicator.classList.add('status-off');
      videoIndicator.title = 'Camera is off';
    }
  }
  
  // Also update in sidebar if exists
  const sidebarVideoIndicator = document.getElementById(`video-sidebar-${userId}`);
  if (sidebarVideoIndicator) {
    if (isOn) {
      sidebarVideoIndicator.innerHTML = '<span class="material-icons">videocam</span>';
      sidebarVideoIndicator.classList.remove('status-off');
      sidebarVideoIndicator.title = 'Camera is on';
    } else {
      sidebarVideoIndicator.innerHTML = '<span class="material-icons">videocam_off</span>';
      sidebarVideoIndicator.classList.add('status-off');
      sidebarVideoIndicator.title = 'Camera is off';
    }
  }
  
  // Also check for the sidebar container
  const sidebarContainer = document.getElementById(`sidebar-container-${userId}`);
  if (sidebarContainer) {
    const sidebarVideo = sidebarContainer.querySelector('.video-status');
    if (sidebarVideo) {
      if (isOn) {
        sidebarVideo.innerHTML = '<span class="material-icons">videocam</span>';
        sidebarVideo.classList.remove('status-off');
        sidebarVideo.title = 'Camera is on';
      } else {
        sidebarVideo.innerHTML = '<span class="material-icons">videocam_off</span>';
        sidebarVideo.classList.add('status-off');
        sidebarVideo.title = 'Camera is off';
      }
    }
  }
}

// Add event listeners to emit status changes when local mic/camera changes
muteBtn.addEventListener("click", () => {
  if (localStream) {
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      audioEnabled = !audioEnabled;
      audioTracks[0].enabled = audioEnabled;
      muteBtn.innerHTML = audioEnabled ? 
        '<span class="material-icons control-icon">mic</span><span class="control-text">Mute</span>' : 
        '<span class="material-icons control-icon">mic_off</span><span class="control-text">Unmute</span>';
      muteBtn.classList.toggle('active', !audioEnabled);
      
      // Update local indicators
      updatePeerMicStatus('local', audioEnabled);
      
      // Emit mic status change to others
      socket.emit("mic-status-change", {
        room: ROOM_ID,
        isOn: audioEnabled
      });
    }
  }
});

videoBtn.addEventListener("click", () => {
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      videoEnabled = !videoEnabled;
      videoTracks[0].enabled = videoEnabled;
      videoBtn.innerHTML = videoEnabled ? 
        '<span class="material-icons control-icon">videocam</span><span class="control-text">Stop Video</span>' : 
        '<span class="material-icons control-icon">videocam_off</span><span class="control-text">Start Video</span>';
      videoBtn.classList.toggle('active', !videoEnabled);
      
      // Update local indicators
      updatePeerVideoStatus('local', videoEnabled);
      
      // Emit video status change to others
      socket.emit("video-status-change", {
        room: ROOM_ID,
        isOn: videoEnabled
      });
    }
  }
});

// Add socket listeners for status changes
socket.on("mic-status-change", ({ userId, isOn }) => {
  console.log(`Received mic status change from ${userId}: ${isOn ? 'on' : 'off'}`);
  
  // Process all matching containers with this userId
  const containers = document.querySelectorAll('.video-item');
  containers.forEach(container => {
    const videoElement = container.querySelector('video');
    if (videoElement) {
      // Extract the base userId without prefixes
      let elementId = videoElement.id;
      if (elementId.startsWith('sidebar-')) {
        elementId = elementId.substring(8);
      }
      if (elementId.startsWith('pinned-')) {
        elementId = elementId.substring(7);
      }
      if (elementId === userId) {
        // Find the mic indicator in this container
        const micIndicator = container.querySelector('.mic-status');
        if (micIndicator) {
          if (isOn) {
            micIndicator.innerHTML = '<span class="material-icons">mic</span>';
            micIndicator.classList.remove('status-off');
            micIndicator.title = 'Microphone is on';
          } else {
            micIndicator.innerHTML = '<span class="material-icons">mic_off</span>';
            micIndicator.classList.add('status-off');
            micIndicator.title = 'Microphone is off';
          }
        }
      }
    }
  });
});

socket.on("video-status-change", ({ userId, isOn }) => {
  console.log(`Received video status change from ${userId}: ${isOn ? 'on' : 'off'}`);
  
  // Process all matching containers with this userId
  const containers = document.querySelectorAll('.video-item');
  containers.forEach(container => {
    const videoElement = container.querySelector('video');
    if (videoElement) {
      // Extract the base userId without prefixes
      let elementId = videoElement.id;
      if (elementId.startsWith('sidebar-')) {
        elementId = elementId.substring(8);
      }
      if (elementId.startsWith('pinned-')) {
        elementId = elementId.substring(7);
      }
      if (elementId === userId) {
        // Find the video indicator in this container
        const videoIndicator = container.querySelector('.video-status');
        if (videoIndicator) {
          if (isOn) {
            videoIndicator.innerHTML = '<span class="material-icons">videocam</span>';
            videoIndicator.classList.remove('status-off');
            videoIndicator.title = 'Camera is on';
          } else {
            videoIndicator.innerHTML = '<span class="material-icons">videocam_off</span>';
            videoIndicator.classList.add('status-off');
            videoIndicator.title = 'Camera is off';
          }
        }
      }
    }
  });
});

// Add CSS style for status indicators to head
const style = document.createElement('style');
style.textContent = `
  .peer-status-indicators {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    gap: 8px;
    z-index: 5;
  }
  
  .status-indicator {
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }
  
  .status-indicator .material-icons {
    font-size: 16px;
  }
  
  .status-indicator.status-off {
    background-color: rgba(255, 0, 0, 0.6);
  }
`;
document.head.appendChild(style);

// Modify the createPeer function to create status indicators
function createPeer(userId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peer.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        to: userId,
        candidate: event.candidate,
        isScreenShare: false
      });
    }
  };

  peer.ontrack = event => {
    // Check if video already exists
    let videoContainer = document.getElementById(`container-${userId}`);
    let remoteVideo = document.getElementById(userId);
    
    if (!videoContainer) {
      // Create new container for video
      videoContainer = document.createElement("div");
      videoContainer.id = `container-${userId}`;
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
      label.textContent = `User ${userId.substring(0, 5)}`;
      
      // Add to DOM
      videoContainer.appendChild(remoteVideo);
      videoContainer.appendChild(label);
      
      // Add status indicators
      addStatusIndicators(videoContainer, userId);
      
      // Add to the appropriate container based on pinned state
      if (pinnedVideoId) {
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
        participantsSidebar.appendChild(sidebarContainer);
        
        // Still add the original container to the videos div but hide it
        addPinButton(videoContainer, userId);
        videoContainer.style.display = 'none';
        videosDiv.appendChild(videoContainer);
      } else {
        // Normal mode - add to grid
        addPinButton(videoContainer, userId);
        videosDiv.appendChild(videoContainer);
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

// Also update the screen sharing peer creation to include pin functionality
function createScreenPeer(userId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peer.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
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
      label.textContent = `Screen: User ${userId.substring(0, 5)}`;
      
      // Add to DOM
      videoContainer.appendChild(screenVideo);
      videoContainer.appendChild(label);
      videoContainer.appendChild(screenIcon);
      
      // Add to the appropriate container based on pinned state
      if (pinnedVideoId) {
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
        sidebarLabel.textContent = `Screen: User ${userId.substring(0, 5)}`;
        
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
        participantsSidebar.appendChild(sidebarContainer);
        
        // Play the video
        sidebarVideo.play().catch(e => console.error("Error playing sidebar screen video:", e));
        
        // Still add the original container but hide it
        addPinButton(videoContainer, `screen-${userId}`);
        videoContainer.style.display = 'none';
        videosDiv.appendChild(videoContainer);
      } else {
        // Normal mode - add to grid
        addPinButton(videoContainer, `screen-${userId}`);
        videosDiv.appendChild(videoContainer);
        
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

// Add a new function to check if videos are visible and restore them if needed
function checkAndRestoreVideos() {
  // Check if local video is visible
  const localVideo = document.getElementById("local");
  const localContainer = document.getElementById("container-local");
  
  if (localVideo && (!localVideo.srcObject || !localVideo.srcObject.active)) {
    // Try to recreate the video stream
    navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: audioConstraints 
    }).then(stream => {
      localVideo.srcObject = stream;
      localVideo.play().catch(e => console.error("Error playing local video:", e));
      
      // Save the new localStream
      localStream = stream;
      
      // Save the video track
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        cameraVideoTrack = videoTracks[0];
      }
      
      // Make sure the container is visible
      if (localContainer) {
        localContainer.style.display = '';
      }
      
      console.log("Local video restored successfully");
    }).catch(err => {
      console.error("Failed to restore local video:", err);
    });
  } else if (localContainer && localContainer.style.display === 'none') {
    // Make sure the container is visible even if the stream is active
    localContainer.style.display = '';
    if (localVideo && localVideo.srcObject) {
      localVideo.play().catch(e => console.error("Error playing local video:", e));
    }
  }
  
  // Also check remote videos
  Object.keys(peers).forEach(userId => {
    const remoteVideo = document.getElementById(userId);
    const remoteContainer = document.getElementById(`container-${userId}`);
    
    if (remoteVideo && (!remoteVideo.srcObject || !remoteVideo.srcObject.active)) {
      // Make the container visible at least
      if (remoteContainer) {
        remoteContainer.style.display = '';
      }
    } else if (remoteContainer && remoteContainer.style.display === 'none') {
      // Make the container visible even if the stream is active
      remoteContainer.style.display = '';
      if (remoteVideo && remoteVideo.srcObject) {
        remoteVideo.play().catch(e => console.error("Error playing remote video:", e));
      }
    }
  });
  
  // Check for local screen share
  if (screenSharingActive) {
    const localScreenVideo = document.getElementById("local-screen");
    const localScreenContainer = document.getElementById("local-screen-container");
    
    if (localScreenContainer && localScreenContainer.style.display === 'none' && !pinnedVideoId) {
      // The screen share should be visible in grid mode but is hidden
      localScreenContainer.style.display = '';
      
      // Make sure video is playing
      if (localScreenVideo && localScreenVideo.srcObject) {
        localScreenVideo.play().catch(e => console.error("Error playing local screen share:", e));
      }
      
      console.log("Local screen share restored to grid");
    } else if (!localScreenContainer && !pinnedVideoId && screenStream) {
      // Screen share container is missing but we have an active screen stream
      // and we're not in pinned mode - recreate the container
      
      console.log("Recreating missing local screen share container");
      
      // Create a container for the screen video
      const videoContainer = document.createElement("div");
      videoContainer.id = "local-screen-container";
      videoContainer.classList.add("video-item", "screen-share-container");
      
      // Create a local video element for screen preview
      const screenVideo = document.createElement("video");
      screenVideo.id = "local-screen";
      screenVideo.muted = true;
      screenVideo.srcObject = screenStream;
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
      label.textContent = "Your Screen";
      
      // Append elements
      videoContainer.appendChild(screenVideo);
      videoContainer.appendChild(label);
      videoContainer.appendChild(screenIcon);
      
      // Add pin button and screen share badge
      addPinButton(videoContainer, "local-screen");
      
      // Add to grid
      videosDiv.appendChild(videoContainer);
      
      console.log("Local screen share container recreated");
    }
  }
  
  // Also check remote screen share containers if they exist
  const screenContainers = document.querySelectorAll('[id^="screen-container-"]');
  screenContainers.forEach(container => {
    if (container.style.display === 'none' && !pinnedVideoId) {
      container.style.display = '';
      const video = container.querySelector('video');
      if (video && video.srcObject) {
        video.play().catch(e => console.error("Error playing screen share:", e));
      }
    }
  });
  
  // Update grid layout
  updateGridLayout();
}

// Call this function periodically to ensure videos stay visible
setInterval(checkAndRestoreVideos, 5000);

// Also modify the screen sharing event listener
screenShareBtn.addEventListener("click", () => {
  if (screenSharingActive) return;
  
  // Before requesting screen share, make sure we have a valid camera track saved
  if (!cameraVideoTrack && localStream) {
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      cameraVideoTrack = videoTracks[0].clone(); // Create a clone to ensure we have a clean copy
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
      
      screenStream = stream;
      screenSharingActive = true;
      
      // Create a container for the screen video
      const videoContainer = document.createElement("div");
      videoContainer.id = "local-screen-container";
      videoContainer.classList.add("video-item", "new-screen-share", "screen-share-container");
      
      // Create a local video element for screen preview
      const screenVideo = document.createElement("video");
      screenVideo.id = "local-screen";
      screenVideo.muted = true;
      screenVideo.srcObject = stream;
      screenVideo.play();
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
      if (pinnedVideoId) {
        const clone = videoContainer.cloneNode(true);
        const cloneVideo = clone.querySelector('video');
        cloneVideo.srcObject = screenStream;
        cloneVideo.id = "sidebar-local-screen";
        clone.id = "sidebar-local-screen-container";
        addVideoLoadedListener(cloneVideo);
        
        // Update pin button for sidebar
        addPinButton(clone, "sidebar-local-screen");
        
        participantsSidebar.appendChild(clone);
      } else {
        // Add to the grid
        videosDiv.appendChild(videoContainer);
        
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
      Object.keys(peers).forEach(userId => {
        shareScreenWithUser(userId);
      });
      
      // Listen for the screen sharing to end
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
        // Check videos again after stopping
        setTimeout(checkAndRestoreVideos, 1000);
      };
      
      screenShareBtn.disabled = true;
      screenShareBtn.classList.add('active');
      stopScreenShareBtn.disabled = false;
      
      // Announce for screen readers
      announceToScreenReaders("Screen sharing started");
    })
    .catch(error => {
      console.error("Error sharing screen:", error);
    });
});

// Add event listener for stopping screen sharing
stopScreenShareBtn.addEventListener("click", () => {
  if (!screenSharingActive) return;
  
  // Add visual feedback
  stopScreenShareBtn.classList.add('stopping');
  
  // Announce to screen readers
  announceToScreenReaders("Stopping screen sharing");
  
  // Stop screen sharing
  stopScreenSharing();
  
  // Remove visual feedback after a short delay
  setTimeout(() => {
    stopScreenShareBtn.classList.remove('stopping');
  }, 500);
});

// Modify stopScreenSharing to also check for video visibility after completion
function stopScreenSharing() {
  if (!screenSharingActive) return;
  
  // If the screen share is pinned, unpin it first
  if (pinnedVideoId === "local-screen") {
    unpinVideo();
  }
  
  // Stop all screen tracks
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  
  // Close all screen sharing peer connections
  Object.values(screenSharingPeers).forEach(peer => peer.close());
  screenSharingPeers = {};
  
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
  if (cameraVideoTrack) {
    // Create a fresh MediaStream with the saved camera track
    const newStream = new MediaStream();
    newStream.addTrack(cameraVideoTrack);
    
    // Add audio tracks from the existing stream if they exist
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        newStream.addTrack(audioTracks[0]);
      }
    }
    
    // Replace localStream with our new stream
    localStream = newStream;
    
    // Update local video with new stream
    const localVideo = document.getElementById("local");
    if (localVideo) {
      localVideo.srcObject = localStream;
      localVideo.play().catch(e => console.error("Error playing local video after screen sharing:", e));
    }
    
    // Enable video if it was previously enabled
    if (videoEnabled && cameraVideoTrack) {
      cameraVideoTrack.enabled = true;
    }
    
    // Update all peers with the new video track
    Object.values(peers).forEach(peer => {
      const senders = peer.getSenders();
      const videoSender = senders.find(sender => 
        sender.track && sender.track.kind === 'video'
      );
      
      if (videoSender && cameraVideoTrack) {
        videoSender.replaceTrack(cameraVideoTrack)
          .catch(e => console.error("Error replacing track:", e));
      } else if (cameraVideoTrack) {
        // If no video sender found, add the track
        peer.addTrack(cameraVideoTrack, localStream);
      }
    });
  } else {
    // If we don't have a stored camera track, try to request camera access again
    navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: audioConstraints 
    }).then(stream => {
      // Set as new local stream
      localStream = stream;
      
      // Save the new camera video track
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        cameraVideoTrack = videoTracks[0];
        // Honor user's video preference
        cameraVideoTrack.enabled = videoEnabled;
      }
      
      // Update local video
      const localVideo = document.getElementById("local");
      if (localVideo) {
        localVideo.srcObject = stream;
        localVideo.play().catch(e => console.error("Error playing local video after reconnect:", e));
      }
      
      // Update all peer connections
      Object.keys(peers).forEach(userId => {
        const peer = peers[userId];
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
  socket.emit("screen-sharing-stopped", ROOM_ID);
  
  screenSharingActive = false;
  screenShareBtn.disabled = false;
  screenShareBtn.classList.remove('active');
  stopScreenShareBtn.disabled = true;
  
  // Ensure all video containers are visible
  setTimeout(() => {
    // Check all videos for visibility issues
    checkAndRestoreVideos();
    // Make sure grid layout is updated properly
    updateGridLayout();
  }, 200);
}

function shareScreenWithUser(userId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  
  screenSharingPeers[userId] = peer;
  
  peer.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        to: userId,
        candidate: event.candidate,
        isScreenShare: true
      });
    }
  };
  
  // Add screen track to peer connection
  screenStream.getTracks().forEach(track => {
    peer.addTrack(track, screenStream);
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
    socket.emit("offer", { 
      to: userId, 
      offer,
      isScreenShare: true 
    });
  });
  
  // Return the peer for possible future reference
  return peer;
}

// Helper function for screen reader announcements
function announceToScreenReaders(message) {
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'assertive');
  announcer.setAttribute('role', 'status');
  announcer.classList.add('sr-only');
  document.body.appendChild(announcer);
  
  setTimeout(() => {
    announcer.textContent = message;
    
    // Remove after announcement
    setTimeout(() => {
      announcer.remove();
    }, 1000);
  }, 100);
}

// Function to add status indicators to a video container
function addStatusIndicators(container, userId) {
  // Create status indicators container
  const statusContainer = document.createElement('div');
  statusContainer.classList.add('peer-status-indicators');
  
  // Create mic indicator
  const micIndicator = document.createElement('div');
  micIndicator.classList.add('status-indicator', 'mic-status');
  micIndicator.innerHTML = '<span class="material-icons">mic</span>';
  micIndicator.title = 'Microphone is on';
  micIndicator.id = `mic-${userId}`;
  
  // Create video indicator
  const videoIndicator = document.createElement('div');
  videoIndicator.classList.add('status-indicator', 'video-status');
  videoIndicator.innerHTML = '<span class="material-icons">videocam</span>';
  videoIndicator.title = 'Camera is on';
  videoIndicator.id = `video-${userId}`;
  
  // Add to status container
  statusContainer.appendChild(micIndicator);
  statusContainer.appendChild(videoIndicator);
  
  // Add to video container
  container.appendChild(statusContainer);
}

// Add style for status indicators
const statusStyle = document.createElement('style');
statusStyle.textContent = `
  .peer-status-indicators {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    gap: 8px;
    z-index: 5;
  }
  
  .status-indicator {
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }
  
  .status-indicator .material-icons {
    font-size: 16px;
  }
  
  .status-indicator.status-off {
    background-color: rgba(255, 0, 0, 0.6);
  }
`;
document.head.appendChild(statusStyle);

// Add socket listeners for status changes
socket.on("mic-status-change", ({ from, isOn }) => {
  updatePeerMicStatus(from, isOn);
});

socket.on("video-status-change", ({ from, isOn }) => {
  updatePeerVideoStatus(from, isOn);
});

// Modify these existing functions to include status indicators
// Modify the muteBtn event listener to emit status change
muteBtn.addEventListener("click", () => {
  if (localStream) {
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      audioEnabled = !audioEnabled;
      audioTracks[0].enabled = audioEnabled;
      muteBtn.innerHTML = audioEnabled ? 
        '<span class="material-icons control-icon">mic</span><span class="control-text">Mute</span>' : 
        '<span class="material-icons control-icon">mic_off</span><span class="control-text">Unmute</span>';
      muteBtn.classList.toggle('active', !audioEnabled);
      
      // Update local indicator
      updatePeerMicStatus('local', audioEnabled);
      
      // Emit status change to peers
      socket.emit("mic-status-change", {
        room: ROOM_ID,
        isOn: audioEnabled
      });
    }
  }
});

// Modify the videoBtn event listener to emit status change
videoBtn.addEventListener("click", () => {
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      videoEnabled = !videoEnabled;
      videoTracks[0].enabled = videoEnabled;
      videoBtn.innerHTML = videoEnabled ? 
        '<span class="material-icons control-icon">videocam</span><span class="control-text">Stop Video</span>' : 
        '<span class="material-icons control-icon">videocam_off</span><span class="control-text">Start Video</span>';
      videoBtn.classList.toggle('active', !videoEnabled);
      
      // Update local indicator
      updatePeerVideoStatus('local', videoEnabled);
      
      // Emit status change to peers
      socket.emit("video-status-change", {
        room: ROOM_ID,
        isOn: videoEnabled
      });
    }
  }
});

// Now modify the createPeer function to add status indicators
function createPeer(userId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peer.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        to: userId,
        candidate: event.candidate,
        isScreenShare: false
      });
    }
  };

  peer.ontrack = event => {
    // Check if video already exists
    let videoContainer = document.getElementById(`container-${userId}`);
    let remoteVideo = document.getElementById(userId);
    
    if (!videoContainer) {
      // Create new container for video
      videoContainer = document.createElement("div");
      videoContainer.id = `container-${userId}`;
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
      label.textContent = `User ${userId.substring(0, 5)}`;
      
      // Add to DOM
      videoContainer.appendChild(remoteVideo);
      videoContainer.appendChild(label);
      
      // Add status indicators
      addStatusIndicators(videoContainer, userId);
      
      // Add to the appropriate container based on pinned state
      if (pinnedVideoId) {
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
        participantsSidebar.appendChild(sidebarContainer);
        
        // Still add the original container to the videos div but hide it
        addPinButton(videoContainer, userId);
        videoContainer.style.display = 'none';
        videosDiv.appendChild(videoContainer);
      } else {
        // Normal mode - add to grid
        addPinButton(videoContainer, userId);
        videosDiv.appendChild(videoContainer);
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