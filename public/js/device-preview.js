// Device Preview and Selection Module

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
}

// Function to get the user's selected devices
function getSelectedDevices() {
  return {
    videoDeviceId: selectedVideoDeviceId,
    audioDeviceId: selectedAudioDeviceId,
    videoEnabled: videoEnabled,
    audioEnabled: audioEnabled
  };
}

// Handle device selection changes
function handleDeviceChange(type, deviceId) {
  if (type === 'video') {
    selectedVideoDeviceId = deviceId;
  } else if (type === 'audio') {
    selectedAudioDeviceId = deviceId;
  }
  
  // Restart preview with new device
  startDevicePreview();
}

// Toggle audio/video state
function toggleAudio() {
  audioEnabled = !audioEnabled;
  updateDevicePreviewUI();
}

function toggleVideo() {
  videoEnabled = !videoEnabled;
  updateDevicePreviewUI();
}

// Export functions
export {
  getAvailableDevices,
  startDevicePreview,
  stopDevicePreview,
  getSelectedDevices,
  handleDeviceChange,
  toggleAudio,
  toggleVideo
}; 