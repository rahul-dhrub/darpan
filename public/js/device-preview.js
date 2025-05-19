// Device Preview and Selection Module
import * as BackgroundEffects from './background-effects.js';

// Audio constraints with noise suppression and echo cancellation
const audioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

// Variables to store selected devices and streams
let previewStream = null;
let availableCameras = [];
let availableMicrophones = [];
let selectedVideoDeviceId = '';
let selectedAudioDeviceId = '';
let audioEnabled = true;
let videoEnabled = true;
let backgroundEffectsProcessor = null;

// Function to get available media devices
async function getAvailableDevices() {
  try {
    // First ensure we have permissions by requesting a stream
    if (!previewStream) {
      previewStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: audioConstraints 
      });
    }
    
    // Get the list of devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    // Filter video devices (cameras)
    availableCameras = devices.filter(device => device.kind === 'videoinput');
    
    // Filter audio input devices (microphones)
    availableMicrophones = devices.filter(device => device.kind === 'audioinput');
    
    // Populate device selection dropdowns
    populateDeviceOptions();
    
    return { cameras: availableCameras, microphones: availableMicrophones };
  } catch (error) {
    console.error("Error getting devices:", error);
    return { cameras: [], microphones: [] };
  }
}

// Function to populate the device selection dropdowns
function populateDeviceOptions() {
  const videoSelect = document.getElementById('camera-select');
  const audioSelect = document.getElementById('microphone-select');
  
  if (!videoSelect || !audioSelect) return;
  
  // Clear existing options
  videoSelect.innerHTML = '';
  audioSelect.innerHTML = '';
  
  // Add camera options
  availableCameras.forEach(camera => {
    const option = document.createElement('option');
    option.value = camera.deviceId;
    option.text = camera.label || `Camera ${availableCameras.indexOf(camera) + 1}`;
    videoSelect.appendChild(option);
  });
  
  // Add microphone options
  availableMicrophones.forEach(mic => {
    const option = document.createElement('option');
    option.value = mic.deviceId;
    option.text = mic.label || `Microphone ${availableMicrophones.indexOf(mic) + 1}`;
    audioSelect.appendChild(option);
  });
  
  // Select the default devices (the ones currently in use)
  if (previewStream) {
    // Get current video track
    const videoTrack = previewStream.getVideoTracks()[0];
    if (videoTrack) {
      const videoSettings = videoTrack.getSettings();
      if (videoSettings.deviceId) {
        selectedVideoDeviceId = videoSettings.deviceId;
        videoSelect.value = selectedVideoDeviceId;
      }
    }
    
    // Get current audio track
    const audioTrack = previewStream.getAudioTracks()[0];
    if (audioTrack) {
      const audioSettings = audioTrack.getSettings();
      if (audioSettings.deviceId) {
        selectedAudioDeviceId = audioSettings.deviceId;
        audioSelect.value = selectedAudioDeviceId;
      }
    }
  }
}

// Function to start preview with selected devices
async function startDevicePreview() {
  const previewVideo = document.getElementById('device-preview-video');
  const audioMeter = document.getElementById('audio-level-meter');
  
  if (!previewVideo) return;
  
  try {
    // Stop any existing preview stream
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
    }
    
    // Create constraints based on selected devices
    const constraints = {
      audio: selectedAudioDeviceId 
        ? { ...audioConstraints, deviceId: { exact: selectedAudioDeviceId } }
        : audioConstraints,
      video: selectedVideoDeviceId
        ? { deviceId: { exact: selectedVideoDeviceId } }
        : true
    };
    
    // Get new stream with selected devices
    previewStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Connect stream to preview video
    previewVideo.srcObject = previewStream;
    previewVideo.play().catch(e => console.error("Error playing preview video:", e));
    
    // Setup audio visualization if we have audio
    if (previewStream.getAudioTracks().length > 0 && audioMeter) {
      setupAudioMeter(previewStream, audioMeter);
    }
    
    // Initialize background effects if available
    const processedVideoCanvas = document.getElementById('processed-video-canvas');
    if (processedVideoCanvas && window.backgroundEffectsInitialized) {
      // Restart background processing with the new stream
      startBackgroundEffectsProcessing(previewVideo, processedVideoCanvas);
    }
    
    // Update UI to reflect current state
    updateDevicePreviewUI();
    
  } catch (error) {
    console.error("Error starting device preview:", error);
    
    // Handle specific errors
    if (error.name === 'NotAllowedError') {
      alert("Permission denied. Please grant camera and microphone permissions.");
    } else if (error.name === 'NotFoundError') {
      alert("Selected device not found. It may have been disconnected.");
    } else {
      alert(`Error accessing media devices: ${error.message}`);
    }
  }
}

// Initialize background effects
async function initBackgroundEffects() {
  const previewVideo = document.getElementById('device-preview-video');
  const processedVideoCanvas = document.getElementById('processed-video-canvas');
  
  if (!previewVideo || !processedVideoCanvas) {
    console.error('Video elements not found');
    return false;
  }
  
  try {
    // Check if device has enough performance for background effects
    const performanceCheck = await BackgroundEffects.checkPerformance();
    
    if (performanceCheck.capable) {
      // Initialize background effects
      const initialized = await BackgroundEffects.initBackgroundEffects(previewVideo, processedVideoCanvas);
      
      if (initialized) {
        // Show the canvas
        processedVideoCanvas.style.display = 'block';
        
        // Start background effects processing
        startBackgroundEffectsProcessing(previewVideo, processedVideoCanvas);
        
        // Add a class to indicate background effects are active
        const videoContainer = previewVideo.parentElement;
        if (videoContainer) {
          videoContainer.classList.add('background-effects-active');
        }
        
        // Save initialization state
        window.backgroundEffectsInitialized = true;
        
        console.log('Background effects initialized successfully');
        return true;
      }
    } else {
      console.warn('Device may not have adequate performance for background effects', performanceCheck);
      alert('Your device may not have adequate performance for background effects. Some effects may impact video quality.');
    }
  } catch (error) {
    console.error('Error initializing background effects:', error);
  }
  
  return false;
}

// Start background effects processing
function startBackgroundEffectsProcessing(videoElement, canvasElement) {
  // Stop any existing processor
  if (backgroundEffectsProcessor) {
    backgroundEffectsProcessor.stop();
  }
  
  // Start a new processor
  backgroundEffectsProcessor = BackgroundEffects.startBackgroundEffects(videoElement);
}

// Set the background effect
function setBackgroundEffect(effectType) {
  if (window.backgroundEffectsInitialized) {
    BackgroundEffects.setBackgroundEffect(effectType);
    
    // Show/hide canvas based on effect type
    const processedVideoCanvas = document.getElementById('processed-video-canvas');
    const videoContainer = document.querySelector('.preview-video-container');
    
    if (processedVideoCanvas && videoContainer) {
      if (effectType === 'none') {
        processedVideoCanvas.style.display = 'none';
        videoContainer.classList.remove('background-effects-active');
      } else {
        processedVideoCanvas.style.display = 'block';
        videoContainer.classList.add('background-effects-active');
      }
    }
    
    console.log(`Applied background effect: ${effectType}`);
  }
}

// Set background color
function setBackgroundColor(color) {
  if (window.backgroundEffectsInitialized) {
    BackgroundEffects.setBackgroundColor(color);
  }
}

// Set background image
function setBackgroundImage(imageUrl) {
  if (window.backgroundEffectsInitialized) {
    BackgroundEffects.setBackgroundImage(imageUrl);
    
    // If we're setting an image, also set the effect to 'image'
    BackgroundEffects.setBackgroundEffect('image');
    
    // Update UI to reflect this
    const effectOptions = document.querySelectorAll('.background-effect-option');
    effectOptions.forEach(option => {
      option.classList.remove('active');
      if (option.getAttribute('data-effect') === 'image') {
        option.classList.add('active');
      }
    });
    
    // Show image controls
    document.querySelectorAll('.custom-background-controls').forEach(
      control => control.classList.remove('active')
    );
    const imageControls = document.getElementById('image-bg-controls');
    if (imageControls) {
      imageControls.classList.add('active');
    }
  }
}

// Set blur radius
function setBlurRadius(radius) {
  if (window.backgroundEffectsInitialized) {
    BackgroundEffects.setBlurRadius(radius);
  }
}

// Setup audio visualization meter
function setupAudioMeter(stream, meterElement) {
  if (!stream || !meterElement) return;
  
  // Create audio context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(stream);
  const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
  
  analyser.smoothingTimeConstant = 0.8;
  analyser.fftSize = 1024;
  
  microphone.connect(analyser);
  analyser.connect(javascriptNode);
  javascriptNode.connect(audioContext.destination);
  
  javascriptNode.onaudioprocess = function() {
    const array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    const values = array.reduce((a, b) => a + b, 0) / array.length;
    
    // Convert the values to a percentage for the meter
    const percentage = Math.min(100, Math.max(0, values * 2));
    meterElement.style.width = `${percentage}%`;
    
    // Change color based on level
    if (percentage > 60) {
      meterElement.style.backgroundColor = '#34a853'; // Green when loud
    } else if (percentage > 20) {
      meterElement.style.backgroundColor = '#4285f4'; // Blue for medium
    } else {
      meterElement.style.backgroundColor = '#dadce0'; // Gray for quiet
    }
  };
}

// Update device preview UI based on enabled/disabled state
function updateDevicePreviewUI() {
  const previewVideo = document.getElementById('device-preview-video');
  const micToggle = document.getElementById('mic-toggle');
  const cameraToggle = document.getElementById('camera-toggle');
  const avatarPlaceholder = document.getElementById('preview-avatar-placeholder');
  
  if (!previewVideo || !micToggle || !cameraToggle) return;
  
  // Update video state
  if (previewStream && previewStream.getVideoTracks().length > 0) {
    const videoTrack = previewStream.getVideoTracks()[0];
    videoTrack.enabled = videoEnabled;
    
    // Update UI elements
    if (videoEnabled) {
      cameraToggle.innerHTML = '<span class="material-icons">videocam</span>';
      cameraToggle.classList.remove('active');
      if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    } else {
      cameraToggle.innerHTML = '<span class="material-icons">videocam_off</span>';
      cameraToggle.classList.add('active');
      if (avatarPlaceholder) {
        avatarPlaceholder.style.display = 'flex';
      } else if (previewVideo.parentElement) {
        // Create avatar placeholder if it doesn't exist
        const newAvatar = document.createElement("div");
        newAvatar.id = 'preview-avatar-placeholder';
        newAvatar.classList.add("avatar-placeholder");
        newAvatar.innerHTML = '<span class="material-icons">person</span>';
        previewVideo.parentElement.appendChild(newAvatar);
      }
    }
  }
  
  // Update audio state
  if (previewStream && previewStream.getAudioTracks().length > 0) {
    const audioTrack = previewStream.getAudioTracks()[0];
    audioTrack.enabled = audioEnabled;
    
    // Update UI elements
    if (audioEnabled) {
      micToggle.innerHTML = '<span class="material-icons">mic</span>';
      micToggle.classList.remove('active');
    } else {
      micToggle.innerHTML = '<span class="material-icons">mic_off</span>';
      micToggle.classList.add('active');
    }
  }
}

// Function to clean up preview resources
function stopDevicePreview() {
  if (previewStream) {
    previewStream.getTracks().forEach(track => track.stop());
    previewStream = null;
  }
  
  // Stop background effects processor
  if (backgroundEffectsProcessor) {
    backgroundEffectsProcessor.stop();
    backgroundEffectsProcessor = null;
  }
}

// Function to get the user's selected devices
function getSelectedDevices() {
  return {
    audioDeviceId: selectedAudioDeviceId,
    videoDeviceId: selectedVideoDeviceId,
    audioEnabled: audioEnabled,
    videoEnabled: videoEnabled,
    backgroundEffect: window.backgroundEffectsInitialized ? BackgroundEffects.getBackgroundSettings() : null
  };
}

// Function to handle device selection change
function handleDeviceChange(type, deviceId) {
  if (type === 'video') {
    selectedVideoDeviceId = deviceId;
  } else if (type === 'audio') {
    selectedAudioDeviceId = deviceId;
  }
  
  // Restart the preview with new device
  startDevicePreview();
}

// Toggle microphone
function toggleAudio() {
  audioEnabled = !audioEnabled;
  updateDevicePreviewUI();
}

// Toggle camera
function toggleVideo() {
  videoEnabled = !videoEnabled;
  updateDevicePreviewUI();
}

export {
  getAvailableDevices,
  startDevicePreview,
  stopDevicePreview,
  getSelectedDevices,
  handleDeviceChange,
  toggleAudio,
  toggleVideo,
  initBackgroundEffects,
  setBackgroundEffect,
  setBackgroundColor,
  setBackgroundImage,
  setBlurRadius
}; 