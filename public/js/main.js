// Main entry point for the application
import { setupSocketListeners } from './socket.js';
import { setupUIElements, setupUIEventListeners, initMeetingUI, updateParticipantCount } from './ui.js';
import { updateGridLayout, updateVideoContainerHeight } from './layout.js';
import { addPinButton, togglePinVideo } from './video-pin.js';
import { addStatusIndicators, updatePeerMicStatus, updatePeerVideoStatus } from './status-indicators.js';
import { addVideoLoadedListener } from './utils.js';

// Global variables
window.socket = io();
// Get room ID from URL parameters or use default
function getRoomIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');
  return roomId || "group-room"; // Use "group-room" as fallback
}
window.ROOM_ID = getRoomIdFromUrl();
window.peers = {};
window.videosDiv = document.getElementById("videos");
window.localStream = null;
window.screenStream = null;
window.screenSharingPeers = {};
window.screenSharingActive = false;
window.audioEnabled = true;
window.videoEnabled = true;
window.chatVisible = false;
window.meetingStartTime = Date.now();
window.pinnedVideoId = null;
window.resizeTimeout = null;
window.cameraVideoTrack = null;
window.meetingTimerInterval = null;
window.totalParticipants = 1; // Start with 1 (local user)
window.headerCollapsed = false;
window.controlsCollapsed = false;

// Advanced audio constraints
const audioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

// Initialize the application
async function init() {
  // Display room ID in UI
  const roomInfoElement = document.createElement('div');
  roomInfoElement.className = 'room-info';
  roomInfoElement.innerHTML = `<span>Room: ${window.ROOM_ID}</span>`;
  document.querySelector('.header').appendChild(roomInfoElement);

  // Setup UI elements and listeners
  setupUIElements();
  setupUIEventListeners();
  
  // Add window resize event listener
  window.addEventListener('resize', () => {
    if (window.resizeTimeout) {
      clearTimeout(window.resizeTimeout);
    }
    
    window.resizeTimeout = setTimeout(() => {
      updateVideoContainerHeight();
      updateGridLayout();
    }, 300);
  });
  
  // Initialize camera and microphone with better error handling
  try {
    try {
      // First try with both video and audio
      window.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: audioConstraints 
      });
    } catch (initialError) {
      console.error("Initial media access error:", initialError);
      
      // If the initial attempt fails, try with just audio
      try {
        console.log("Trying with audio only...");
        window.localStream = await navigator.mediaDevices.getUserMedia({ 
          video: false, 
          audio: audioConstraints 
        });
        
        // Set video as disabled since we couldn't get it
        window.videoEnabled = false;
        
        // Update UI to reflect video-off state
        if (window.videoBtn) {
          window.videoBtn.innerHTML = '<span class="material-icons control-icon">videocam_off</span><span class="control-text">Start Video</span>';
          window.videoBtn.classList.add('active');
        }
        
        // Show a warning to the user
        alert("Camera access was denied. Continuing with audio only. You can try enabling your camera later.");
      } catch (audioOnlyError) {
        // If audio-only also fails, try with just video
        console.error("Audio-only access error:", audioOnlyError);
        
        try {
          console.log("Trying with video only...");
          window.localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false
          });
          
          // Set audio as disabled since we couldn't get it
          window.audioEnabled = false;
          
          // Update UI to reflect muted state
          if (window.muteBtn) {
            window.muteBtn.innerHTML = '<span class="material-icons control-icon">mic_off</span><span class="control-text">Unmute</span>';
            window.muteBtn.classList.add('active');
          }
          
          // Show a warning to the user
          alert("Microphone access was denied. Continuing with video only. You can try enabling your microphone later.");
        } catch (videoOnlyError) {
          // If everything fails, throw a comprehensive error
          console.error("Video-only access error:", videoOnlyError);
          throw new Error("Could not access camera or microphone. Please check your device permissions.");
        }
      }
    }
    
    // Initialize meeting UI elements
    initMeetingUI();
    
    // Save the original camera video track for reference
    const videoTracks = window.localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      window.cameraVideoTrack = videoTracks[0];
    }
    
    // Create local video container
    createLocalVideoContainer();
    
    // Update grid layout
    updateGridLayout();
    
    // Reset participant count to ensure we start fresh
    window.totalParticipants = 1;
    updateParticipantCount();
    
    // Join the room
    window.socket.emit("join-room", ROOM_ID);
    
    // Setup socket event listeners
    setupSocketListeners();
    
    // Call updateVideoContainerHeight once when the page loads
    window.addEventListener('load', () => {
      updateVideoContainerHeight();
    });
  } catch (error) {
    console.error("Error initializing media devices:", error);
    
    // Create a more helpful error message with troubleshooting steps
    const errorContainer = document.createElement("div");
    errorContainer.className = "error-container";
    errorContainer.innerHTML = `
      <div class="error-box">
        <h2>Media Access Error</h2>
        <p>Failed to access camera and microphone: ${error.message || "Unknown error"}</p>
        <p>Please try the following steps:</p>
        <ul>
          <li>Check that your camera and microphone are properly connected</li>
          <li>Make sure you've granted camera and microphone permissions in your browser settings</li>
          <li>Ensure no other applications are using your camera/microphone</li>
          <li>Try using a different browser (Chrome or Firefox recommended)</li>
          <li>Restart your browser and try again</li>
        </ul>
        <button id="retryButton" class="retry-button">Retry Access</button>
        <button id="audioOnlyButton" class="audio-only-button">Join with Audio Only</button>
      </div>
    `;
    
    // Insert the error message into the page
    document.querySelector(".main-content").appendChild(errorContainer);
    
    // Add event listeners for the retry and audio-only buttons
    document.getElementById("retryButton").addEventListener("click", () => {
      errorContainer.remove();
      init(); // Try initialization again
    });
    
    document.getElementById("audioOnlyButton").addEventListener("click", async () => {
      try {
        window.localStream = await navigator.mediaDevices.getUserMedia({ 
          video: false, 
          audio: audioConstraints 
        });
        
        window.videoEnabled = false;
        errorContainer.remove();
        
        // Continue with the initialization
        initMeetingUI();
        createLocalVideoContainer();
        updateGridLayout();
        window.totalParticipants = 1;
        updateParticipantCount();
        window.socket.emit("join-room", ROOM_ID);
        setupSocketListeners();
      } catch (audioError) {
        console.error("Audio-only access error:", audioError);
        alert("Could not access microphone. Please check your device permissions and try again.");
      }
    });
  }
}

// Create a container for the local video
function createLocalVideoContainer() {
  // Create a container for the video
  const videoContainer = document.createElement("div");
  videoContainer.classList.add("video-item");
  videoContainer.id = "container-local";
  
  // Create the video element
  const localVideo = document.createElement("video");
  localVideo.muted = true;
  localVideo.playsinline = true;
  localVideo.srcObject = window.localStream;
  localVideo.play().catch(e => console.error("Error playing local video:", e));
  localVideo.classList.add("local-video");
  localVideo.id = "local";
  
  // Check if video track exists, if not, add a user avatar placeholder
  const hasVideoTrack = window.localStream.getVideoTracks().length > 0;
  
  if (!hasVideoTrack) {
    // Add video-off class to container
    videoContainer.classList.add("video-off");
    
    // Create avatar placeholder
    const avatarPlaceholder = document.createElement("div");
    avatarPlaceholder.classList.add("avatar-placeholder");
    avatarPlaceholder.innerHTML = '<span class="material-icons">person</span>';
    videoContainer.appendChild(avatarPlaceholder);
    
    // Update video status
    window.videoEnabled = false;
  }
  
  // Add aspect ratio listener
  addVideoLoadedListener(localVideo);
  
  // Create local video controls to replace the "You" label
  const localControls = document.createElement("div");
  localControls.classList.add("local-controls");
  
  // Create mic toggle button
  const localMicBtn = document.createElement('button');
  localMicBtn.classList.add('local-control-btn');
  
  // Check audio status
  const hasAudioTrack = window.localStream.getAudioTracks().length > 0;
  const audioEnabled = hasAudioTrack ? window.audioEnabled : false;
  
  // Set appropriate icon based on audio status
  localMicBtn.innerHTML = audioEnabled 
    ? '<span class="material-icons">mic</span>' 
    : '<span class="material-icons">mic_off</span>';
  
  localMicBtn.title = 'Toggle microphone';
  localMicBtn.addEventListener('click', () => {
    if (window.localStream) {
      const audioTracks = window.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        window.audioEnabled = !window.audioEnabled;
        audioTracks[0].enabled = window.audioEnabled;
        window.muteBtn.innerHTML = window.audioEnabled ? 
          '<span class="material-icons control-icon">mic</span><span class="control-text">Mute</span>' : 
          '<span class="material-icons control-icon">mic_off</span><span class="control-text">Unmute</span>';
        window.muteBtn.classList.toggle('active', !window.audioEnabled);
        localMicBtn.innerHTML = window.audioEnabled ? 
          '<span class="material-icons">mic</span>' : 
          '<span class="material-icons">mic_off</span>';
        
        // Update status indicators
        updatePeerMicStatus('local', window.audioEnabled);
        
        // Emit status change to others
        window.socket.emit("mic-status-change", {
          room: ROOM_ID,
          isOn: window.audioEnabled
        });
      } else {
        alert("No microphone detected. Please check your device settings.");
      }
    }
  });
  
  // Create camera toggle button
  const localVideoBtn = document.createElement('button');
  localVideoBtn.classList.add('local-control-btn');
  
  // Set appropriate icon based on video status
  localVideoBtn.innerHTML = hasVideoTrack && window.videoEnabled
    ? '<span class="material-icons">videocam</span>'
    : '<span class="material-icons">videocam_off</span>';
  
  localVideoBtn.title = 'Toggle camera';
  localVideoBtn.addEventListener('click', () => {
    if (window.localStream) {
      const videoTracks = window.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        window.videoEnabled = !window.videoEnabled;
        videoTracks[0].enabled = window.videoEnabled;
        window.videoBtn.innerHTML = window.videoEnabled ? 
          '<span class="material-icons control-icon">videocam</span><span class="control-text">Stop Video</span>' : 
          '<span class="material-icons control-icon">videocam_off</span><span class="control-text">Start Video</span>';
        window.videoBtn.classList.toggle('active', !window.videoEnabled);
        localVideoBtn.innerHTML = window.videoEnabled ? 
          '<span class="material-icons">videocam</span>' : 
          '<span class="material-icons">videocam_off</span>';
        
        // Toggle avatar placeholder
        const avatarPlaceholder = videoContainer.querySelector('.avatar-placeholder');
        if (window.videoEnabled) {
          videoContainer.classList.remove('video-off');
          if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
        } else {
          videoContainer.classList.add('video-off');
          if (avatarPlaceholder) {
            avatarPlaceholder.style.display = 'flex';
          } else {
            const newAvatar = document.createElement("div");
            newAvatar.classList.add("avatar-placeholder");
            newAvatar.innerHTML = '<span class="material-icons">person</span>';
            videoContainer.appendChild(newAvatar);
          }
        }
        
        // Update status indicators
        updatePeerVideoStatus('local', window.videoEnabled);
        
        // Emit status change to others
        window.socket.emit("video-status-change", {
          room: ROOM_ID,
          isOn: window.videoEnabled
        });
      } else {
        // If no video track, try to request one
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(videoStream => {
            const videoTrack = videoStream.getVideoTracks()[0];
            
            // If we already have a stream, add the track to it
            if (window.localStream) {
              window.localStream.addTrack(videoTrack);
              window.cameraVideoTrack = videoTrack;
              window.videoEnabled = true;
              
              // Update UI
              videoContainer.classList.remove('video-off');
              const avatarPlaceholder = videoContainer.querySelector('.avatar-placeholder');
              if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
              
              localVideoBtn.innerHTML = '<span class="material-icons">videocam</span>';
              window.videoBtn.innerHTML = '<span class="material-icons control-icon">videocam</span><span class="control-text">Stop Video</span>';
              window.videoBtn.classList.remove('active');
              
              // Update local video element
              localVideo.srcObject = window.localStream;
              localVideo.play().catch(e => console.error("Error playing local video:", e));
              
              // Update status indicators and notify peers
              updatePeerVideoStatus('local', true);
              window.socket.emit("video-status-change", {
                room: ROOM_ID,
                isOn: true
              });
              
              // Add video track to all peer connections
              Object.values(window.peers).forEach(peer => {
                peer.addTrack(videoTrack, window.localStream);
              });
            }
          })
          .catch(err => {
            console.error("Failed to get camera access:", err);
            alert("Could not access camera. Please check your permissions and try again.");
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
  
  // Add "You" label
  const label = document.createElement("div");
  label.classList.add("user-label");
  label.textContent = "You";
  videoContainer.appendChild(label);
  
  // Add pin button with tooltip
  addPinButton(videoContainer, "local");
  
  // Add status indicators
  addStatusIndicators(videoContainer, 'local');
  updatePeerMicStatus('local', hasAudioTrack && window.audioEnabled);
  updatePeerVideoStatus('local', hasVideoTrack && window.videoEnabled);
  
  window.videosDiv.appendChild(videoContainer);
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions that need to be accessed from other modules
export {
  audioConstraints,
  createLocalVideoContainer
}; 