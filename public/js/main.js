// Main entry point for the application
import { setupSocketListeners } from './socket.js';
import { setupUIElements, setupUIEventListeners, initMeetingUI, updateParticipantCount } from './ui.js';
import { updateGridLayout, updateVideoContainerHeight } from './layout.js';
import { addPinButton, togglePinVideo } from './video-pin.js';
import { addStatusIndicators, updatePeerMicStatus, updatePeerVideoStatus } from './status-indicators.js';
import { addVideoLoadedListener } from './utils.js';
import * as BackgroundEffects from './background-effects.js';
import { initReactions, setupReactionsListeners } from './reactions.js';
import { initRaiseHand, setupRaiseHandListeners } from './raise-hand.js';
import { initMenu } from './menu.js';

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
window.backgroundEffectsInitialized = false;
window.backgroundEffectsProcessor = null;
window.backgroundPanelVisible = false;
window.savedBackgroundSettings = null; // Store the saved background settings

// Advanced audio constraints
const audioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

// Get selected devices from session storage if available
function getSelectedDevicesFromSession() {
  const savedDevices = sessionStorage.getItem('selectedDevices');
  if (savedDevices) {
    try {
      return JSON.parse(savedDevices);
    } catch (error) {
      console.error("Error parsing selected devices from session:", error);
    }
  }
  return null;
}

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
  setupBackgroundPanelListeners();
  
  // Initialize emoji reactions
  initReactions();
  setupReactionsListeners();
  
  // Initialize raise hand feature
  initRaiseHand();
  setupRaiseHandListeners();
  
  // Initialize menu feature
  initMenu();
  
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
    // Check for previously selected devices from device preview
    const selectedDevices = getSelectedDevicesFromSession();
    
    try {
      if (selectedDevices) {
        // Use selected devices from preview
        const constraints = {
          audio: selectedDevices.audioDeviceId ? 
            { ...audioConstraints, deviceId: { exact: selectedDevices.audioDeviceId } } : 
            selectedDevices.audioEnabled ? audioConstraints : false,
          video: selectedDevices.videoDeviceId ? 
            { deviceId: { exact: selectedDevices.videoDeviceId } } : 
            selectedDevices.videoEnabled
        };
        
        window.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Set initial audio/video enabled state
        window.audioEnabled = selectedDevices.audioEnabled;
        window.videoEnabled = selectedDevices.videoEnabled;
        
        // Save background settings if available for later use
        if (selectedDevices.backgroundEffect) {
          try {
            // Store the background settings for applying after initialization
            window.savedBackgroundSettings = selectedDevices.backgroundEffect;
            console.log("Saved background settings for restoration:", window.savedBackgroundSettings);
          } catch (bgError) {
            console.error("Error saving background settings:", bgError);
          }
        }
        
        // Clear session storage after use
        sessionStorage.removeItem('selectedDevices');
      } else {
        // First try with both video and audio
        window.localStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: audioConstraints 
        });
      }
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
    
    // Update UI to reflect audio/video state from device selection
    if (!window.audioEnabled) {
      if (window.muteBtn) {
        window.muteBtn.innerHTML = '<span class="material-icons control-icon">mic_off</span><span class="control-text">Unmute</span>';
        window.muteBtn.classList.add('active');
      }
    }
    
    if (!window.videoEnabled) {
      if (window.videoBtn) {
        window.videoBtn.innerHTML = '<span class="material-icons control-icon">videocam_off</span><span class="control-text">Start Video</span>';
        window.videoBtn.classList.add('active');
      }
    }
    
    // Save the original camera video track for reference
    const videoTracks = window.localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      window.cameraVideoTrack = videoTracks[0];
      // Ensure video track enabled state matches setting
      videoTracks[0].enabled = window.videoEnabled;
    }
    
    // Ensure audio track enabled state matches setting
    const audioTracks = window.localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      audioTracks[0].enabled = window.audioEnabled;
    }
    
    // Create local video container
    createLocalVideoContainer();
    
    // Update grid layout
    updateGridLayout();
    
    // Reset participant count to ensure we start fresh
    window.totalParticipants = 1;
    updateParticipantCount();
    
    // Initialize background effects if video is enabled
    if (window.videoEnabled && window.savedBackgroundSettings) {
      await initializeBackgroundEffects();
      // Apply saved background effect after initializing
      applyBackgroundSettings(window.savedBackgroundSettings);
    }
    
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
  videoContainer.id = "localVideoContainer"; // Using consistent ID format with raise-hand.js
  
  // Create the video element
  const localVideo = document.createElement("video");
  localVideo.muted = true;
  localVideo.playsinline = true;
  localVideo.srcObject = window.localStream;
  localVideo.play().catch(e => console.error("Error playing local video:", e));
  localVideo.classList.add("local-video");
  localVideo.id = "local";
  
  // Create a canvas for processed video with background effects
  const processedVideoCanvas = document.createElement("canvas");
  processedVideoCanvas.classList.add("processed-video-canvas");
  processedVideoCanvas.id = "local-processed-canvas";
  processedVideoCanvas.style.display = "none"; // Hide initially until background effect is applied
  
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
          
          // Reapply background effect if needed when video is enabled
          if (window.backgroundEffectsInitialized && window.savedBackgroundSettings) {
            // If we have saved background settings and video was just enabled, reapply them
            applyBackgroundSettings(window.savedBackgroundSettings);
          }
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
          
          // Hide the processed canvas when video is disabled
          const processedCanvas = document.getElementById('local-processed-canvas');
          if (processedCanvas) {
            processedCanvas.style.display = 'none';
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
  videoContainer.appendChild(processedVideoCanvas);
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
  
  // Initialize background effects if video is enabled
  if (hasVideoTrack && window.videoEnabled) {
    initializeBackgroundEffects();
  }
}

// Setup background panel event listeners
function setupBackgroundPanelListeners() {
  const backgroundBtn = document.getElementById('backgroundBtn');
  const backgroundPanel = document.getElementById('backgroundPanel');
  const backgroundPanelClose = document.getElementById('backgroundPanelClose');
  
  if (!backgroundBtn || !backgroundPanel || !backgroundPanelClose) return;
  
  // Toggle background panel
  backgroundBtn.addEventListener('click', () => {
    window.backgroundPanelVisible = !window.backgroundPanelVisible;
    backgroundPanel.classList.toggle('visible', window.backgroundPanelVisible);
    backgroundBtn.classList.toggle('active', window.backgroundPanelVisible);
    
    // Initialize background effects if not already done
    if (window.backgroundPanelVisible && !window.backgroundEffectsInitialized) {
      initializeBackgroundEffects();
    }
  });
  
  // Close background panel
  backgroundPanelClose.addEventListener('click', () => {
    window.backgroundPanelVisible = false;
    backgroundPanel.classList.remove('visible');
    backgroundBtn.classList.remove('active');
  });
  
  // Setup background effect selection
  const effectOptions = document.querySelectorAll('.background-effect-option');
  effectOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove active class from all options
      effectOptions.forEach(opt => opt.classList.remove('active'));
      
      // Add active class to selected option
      option.classList.add('active');
      
      // Hide all custom controls
      document.querySelectorAll('.custom-background-controls').forEach(
        control => control.classList.remove('active')
      );
      
      // Get the selected effect
      const effect = option.getAttribute('data-effect');
      
      // Show relevant custom controls
      if (effect === 'color') {
        document.getElementById('color-bg-controls').classList.add('active');
      } else if (effect === 'image') {
        document.getElementById('image-bg-controls').classList.add('active');
        
        // Auto-select the first image if available
        const firstPresetBackground = document.querySelector('.preset-background');
        if (firstPresetBackground && window.backgroundEffectsInitialized) {
          const imageUrl = firstPresetBackground.getAttribute('data-image');
          
          // Only set if not already set (don't override if user already selected an image)
          const preview = document.getElementById('meeting-image-preview');
          if (!preview.classList.contains('active')) {
            // Show image preview
            preview.style.backgroundImage = `url(${imageUrl})`;
            preview.classList.add('active');
            
            // Set as background
            BackgroundEffects.setBackgroundImage(imageUrl);
          }
        }
      } else if (effect === 'blur') {
        document.getElementById('blur-bg-controls').classList.add('active');
      }
      
      // Apply the selected effect
      if (window.backgroundEffectsInitialized) {
        BackgroundEffects.setBackgroundEffect(effect);
        
        // Show/hide canvas based on effect type
        const processedVideoCanvas = document.getElementById('local-processed-canvas');
        const videoContainer = document.getElementById('container-local');
        
        if (processedVideoCanvas && videoContainer) {
          if (effect === 'none') {
            processedVideoCanvas.style.display = 'none';
            videoContainer.classList.remove('background-effects-active');
          } else {
            processedVideoCanvas.style.display = 'block';
            videoContainer.classList.add('background-effects-active');
          }
        }
        
        console.log(`Applied background effect: ${effect}`);
      }
    });
  });
  
  // Blur intensity slider
  const blurSlider = document.getElementById('meeting-blur-intensity');
  const blurValue = document.getElementById('meeting-blur-value');
  
  if (blurSlider && blurValue) {
    blurSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      blurValue.textContent = value;
      if (window.backgroundEffectsInitialized) {
        BackgroundEffects.setBlurRadius(Number(value));
      }
    });
  }
  
  // Background color picker
  const colorPicker = document.getElementById('meeting-background-color-picker');
  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      if (window.backgroundEffectsInitialized) {
        BackgroundEffects.setBackgroundColor(e.target.value);
        
        // Remove active class from all preset colors
        document.querySelectorAll('.preset-color').forEach(color => {
          color.classList.remove('active');
        });
      }
    });
  }
  
  // Setup preset color selection
  const presetColors = document.querySelectorAll('.preset-color');
  presetColors.forEach(colorElement => {
    colorElement.addEventListener('click', () => {
      const color = colorElement.getAttribute('data-color');
      
      // Update color picker value
      if (colorPicker) {
        colorPicker.value = color;
      }
      
      // Apply the color
      if (window.backgroundEffectsInitialized) {
        BackgroundEffects.setBackgroundColor(color);
      }
      
      // Update active state
      presetColors.forEach(c => c.classList.remove('active'));
      colorElement.classList.add('active');
    });
  });
  
  // Background image upload
  const uploadBtn = document.getElementById('meeting-upload-image-btn');
  const fileInput = document.getElementById('meeting-background-image-upload');
  
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const imageURL = URL.createObjectURL(file);
        
        // Show image preview
        const preview = document.getElementById('meeting-image-preview');
        if (preview) {
          preview.style.backgroundImage = `url(${imageURL})`;
          preview.classList.add('active');
        }
        
        // Set as background
        if (window.backgroundEffectsInitialized) {
          BackgroundEffects.setBackgroundImage(imageURL);
          BackgroundEffects.setBackgroundEffect('image');
          
          // Update UI to reflect image selection
          effectOptions.forEach(opt => opt.classList.remove('active'));
          const imageOption = document.querySelector('.background-effect-option[data-effect="image"]');
          if (imageOption) {
            imageOption.classList.add('active');
          }
        }
      }
    });
  }
  
  // Preset background images
  const presetBackgrounds = document.querySelectorAll('.preset-background');
  presetBackgrounds.forEach(preset => {
    preset.addEventListener('click', () => {
      const imageUrl = preset.getAttribute('data-image');
      
      // Show image preview
      const preview = document.getElementById('meeting-image-preview');
      if (preview) {
        preview.style.backgroundImage = `url(${imageUrl})`;
        preview.classList.add('active');
      }
      
      // Set as background
      if (window.backgroundEffectsInitialized) {
        BackgroundEffects.setBackgroundImage(imageUrl);
        BackgroundEffects.setBackgroundEffect('image');
        
        // Update UI to reflect image selection
        effectOptions.forEach(opt => opt.classList.remove('active'));
        const imageOption = document.querySelector('.background-effect-option[data-effect="image"]');
        if (imageOption) {
          imageOption.classList.add('active');
        }
      }
    });
  });
}

// Initialize background effects
async function initializeBackgroundEffects() {
  const localVideo = document.getElementById('local');
  const processedCanvas = document.getElementById('local-processed-canvas');
  
  if (!localVideo || !processedCanvas) {
    console.error('Video elements not found for background effects');
    return false;
  }
  
  try {
    // Check if device has enough performance for background effects
    const performanceCheck = await BackgroundEffects.checkPerformance();
    
    if (performanceCheck.capable) {
      // Initialize background effects
      const initialized = await BackgroundEffects.initBackgroundEffects(localVideo, processedCanvas);
      
      if (initialized) {
        // Show the canvas (will be shown/hidden based on effect selection later)
        processedCanvas.style.display = 'none'; // Initially hide until an effect is selected
        
        // Start background effects processing
        if (window.backgroundEffectsProcessor) {
          window.backgroundEffectsProcessor.stop();
        }
        
        window.backgroundEffectsProcessor = BackgroundEffects.startBackgroundEffects(localVideo);
        window.backgroundEffectsInitialized = true;
        
        console.log('Background effects initialized successfully');
        return true;
      }
    } else {
      console.warn('Device may not have adequate performance for background effects', performanceCheck);
      alert('Your device may not have adequate performance for background effects. This feature might affect performance.');
    }
  } catch (error) {
    console.error('Error initializing background effects:', error);
  }
  
  return false;
}

// Apply saved background settings 
function applyBackgroundSettings(bgSettings) {
  if (!bgSettings || !window.backgroundEffectsInitialized) {
    return;
  }
  
  console.log("Applying background settings:", bgSettings);
  
  // Apply effect type (must be done first)
  if (bgSettings.currentEffect && bgSettings.currentEffect !== 'none') {
    BackgroundEffects.setBackgroundEffect(bgSettings.currentEffect);
    
    // Update UI to reflect the background effect selection
    const effectOptions = document.querySelectorAll('.background-effect-option');
    if (effectOptions.length > 0) {
      effectOptions.forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('data-effect') === bgSettings.currentEffect) {
          option.classList.add('active');
        }
      });
      
      // Show relevant controls based on effect type
      document.querySelectorAll('.custom-background-controls').forEach(
        control => control.classList.remove('active')
      );
      
      // Show the appropriate control panel based on effect type
      if (bgSettings.currentEffect === 'blur') {
        const blurControls = document.getElementById('blur-bg-controls');
        if (blurControls) blurControls.classList.add('active');
      } else if (bgSettings.currentEffect === 'color') {
        const colorControls = document.getElementById('color-bg-controls');
        if (colorControls) colorControls.classList.add('active');
      } else if (bgSettings.currentEffect === 'image') {
        const imageControls = document.getElementById('image-bg-controls');
        if (imageControls) imageControls.classList.add('active');
      }
    }
    
    // Apply specific properties based on effect type
    switch (bgSettings.currentEffect) {
      case 'blur':
        if (bgSettings.blurRadius !== undefined) {
          BackgroundEffects.setBlurRadius(bgSettings.blurRadius);
          
          // Update slider value if available
          const blurSlider = document.getElementById('meeting-blur-intensity');
          const blurValue = document.getElementById('meeting-blur-value');
          if (blurSlider && blurValue) {
            blurSlider.value = bgSettings.blurRadius;
            blurValue.textContent = bgSettings.blurRadius;
          }
        }
        break;
        
      case 'color':
        if (bgSettings.backgroundColor) {
          BackgroundEffects.setBackgroundColor(bgSettings.backgroundColor);
          
          // Update color picker if available
          const colorPicker = document.getElementById('meeting-background-color-picker');
          if (colorPicker) {
            colorPicker.value = bgSettings.backgroundColor;
          }
        }
        break;
        
      case 'image':
        if (bgSettings.backgroundImageURL) {
          BackgroundEffects.setBackgroundImage(bgSettings.backgroundImageURL);
          
          // Update image preview if available
          const preview = document.getElementById('meeting-image-preview');
          if (preview) {
            preview.style.backgroundImage = `url(${bgSettings.backgroundImageURL})`;
            preview.classList.add('active');
          }
        }
        break;
    }
    
          // Only show the canvas and add the effect class if video is enabled
    if (window.videoEnabled) {
      // Show the canvas
      const processedVideoCanvas = document.getElementById('local-processed-canvas');
      const videoContainer = document.getElementById('localVideoContainer');
      
      if (processedVideoCanvas && videoContainer) {
        processedVideoCanvas.style.display = 'block';
        videoContainer.classList.add('background-effects-active');
      }
    }
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Import and use debugging tools
import * as Debug from './debug.js';

// Start debug monitoring when in development mode
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("Starting debug monitoring");
    setTimeout(() => {
      Debug.monitorPeerConnections();
      Debug.fixVideoContainerIds();
    }, 5000); // Start after 5 seconds to let connections initialize
  });
}

// Export functions that need to be accessed from other modules
export {
  audioConstraints,
  createLocalVideoContainer
}; 