// Module for recording functionality

// Store recording state
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingStream = null;
let recordingStartTime = null;
let ffmpegLoaded = false;
let ffmpegInstance = null;

// Load FFmpeg dynamically when needed
async function loadFFmpeg() {
  if (!ffmpegLoaded) {
    try {
      // Since SharedArrayBuffer is not available, we'll use a web service approach instead
      console.log('Using alternative video conversion approach');
      ffmpegLoaded = true;
      return true;
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      throw error;
    }
  }
  
  return true;
}

// Start recording
async function startRecording() {
  if (isRecording) return;
  
  try {
    // Create a new stream that includes both audio and video from the meeting
    const tracks = [];
    
    // Add local audio track if available
    if (window.localStream) {
      const audioTracks = window.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        tracks.push(audioTracks[0]);
      }
    }
    
    // Combine all video streams into a canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match the video container
    const mainContent = document.querySelector('.videos-container');
    if (mainContent) {
      canvas.width = mainContent.offsetWidth;
      canvas.height = mainContent.offsetHeight;
    } else {
      canvas.width = 1280;
      canvas.height = 720;
    }
    
    // Hide canvas but keep it in DOM for recording
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    
    // Create a stream from the canvas
    const canvasStream = canvas.captureStream(30); // 30 FPS
    
    // Add the canvas video track
    const videoTracks = canvasStream.getVideoTracks();
    if (videoTracks.length > 0) {
      tracks.push(videoTracks[0]);
    }
    
    // Function to draw video elements onto canvas
    function drawVideoElements() {
      // Clear canvas
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw all video elements
      const videoElements = document.querySelectorAll('.video-item video');
      const totalVideos = videoElements.length;
      
      if (totalVideos === 0) return;
      
      let rows, cols;
      if (totalVideos === 1) {
        rows = 1;
        cols = 1;
      } else if (totalVideos <= 4) {
        rows = 2;
        cols = 2;
      } else if (totalVideos <= 9) {
        rows = 3;
        cols = 3;
      } else {
        rows = 4;
        cols = Math.ceil(totalVideos / 4);
      }
      
      const cellWidth = canvas.width / cols;
      const cellHeight = canvas.height / rows;
      
      let indexCounter = 0;
      for (let i = 0; i < rows && indexCounter < totalVideos; i++) {
        for (let j = 0; j < cols && indexCounter < totalVideos; j++) {
          const video = videoElements[indexCounter];
          
          if (video && video.readyState >= 2) { // HAVE_CURRENT_DATA or better
            try {
              // Draw video frame to canvas directly from the video element
              ctx.drawImage(
                video,
                j * cellWidth,
                i * cellHeight,
                cellWidth,
                cellHeight
              );
              
              // Add user label
              const container = video.closest('.video-item');
              if (container) {
                const label = container.querySelector('.user-label');
                if (label) {
                  const labelText = label.textContent;
                  
                  // Draw label background
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                  ctx.fillRect(
                    j * cellWidth + 5,
                    i * cellHeight + cellHeight - 25,
                    120,
                    20
                  );
                  
                  // Draw label text
                  ctx.fillStyle = 'white';
                  ctx.font = '12px Arial';
                  ctx.fillText(
                    labelText,
                    j * cellWidth + 10,
                    i * cellHeight + cellHeight - 10
                  );
                }
              }
            } catch (e) {
              console.error('Error drawing video on canvas:', e);
            }
          } else {
            // Draw placeholder for inactive video
            ctx.fillStyle = '#2d3748';
            ctx.fillRect(
              j * cellWidth,
              i * cellHeight,
              cellWidth,
              cellHeight
            );
            
            // Draw avatar placeholder
            ctx.fillStyle = '#3a6186';
            ctx.beginPath();
            ctx.arc(
              j * cellWidth + cellWidth / 2,
              i * cellHeight + cellHeight / 2,
              Math.min(cellWidth, cellHeight) * 0.2,
              0,
              Math.PI * 2
            );
            ctx.fill();
            
            // Draw person icon
            ctx.fillStyle = 'white';
            ctx.font = `${Math.min(cellWidth, cellHeight) * 0.3}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              '👤',
              j * cellWidth + cellWidth / 2,
              i * cellHeight + cellHeight / 2
            );
          }
          
          indexCounter++;
        }
      }
      
      // Draw recording indicator
      const now = new Date();
      const elapsed = recordingStartTime ? now - recordingStartTime : 0;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      ctx.fillStyle = 'rgba(234, 67, 53, 0.8)';
      ctx.beginPath();
      ctx.arc(30, 30, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(
        `Recording: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        45,
        35
      );
      
      // Continue drawing frames
      if (isRecording) {
        requestAnimationFrame(drawVideoElements);
      }
    }
    
    // Create the animation loop
    let animationFrameId = requestAnimationFrame(function animate() {
      drawVideoElements();
      if (isRecording) {
        animationFrameId = requestAnimationFrame(animate);
      }
    });
    
    // Create a combined stream for recording
    recordingStream = new MediaStream(tracks);
    
    // Setup MediaRecorder with better quality options
    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 3000000 // 3 Mbps
    };
    
    try {
      mediaRecorder = new MediaRecorder(recordingStream, options);
    } catch (e) {
      // Fallback for unsupported codec
      console.log('VP9 not supported, trying VP8');
      mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });
    }
    
    // Reset recorded chunks
    recordedChunks = [];
    
    // Handle dataavailable event to collect recorded chunks
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };
    
    // Handle stop event to create and download recording
    mediaRecorder.onstop = () => {
      // Clean up canvas element
      document.body.removeChild(canvas);
      
      // Create blob from recorded chunks
      const blob = new Blob(recordedChunks, {
        type: 'video/webm'
      });
      
      // Create download link
      downloadRecording(blob);
      
      // Reset recording state
      isRecording = false;
      recordingStream = null;
      recordedChunks = [];
      
      // Update UI
      updateRecordingUI(false);
    };
    
    // Start recording with chunks every 1 second
    mediaRecorder.start(1000);
    recordingStartTime = new Date();
    isRecording = true;
    
    // Update UI
    updateRecordingUI(true);
    
    // Add recording indicator to the UI
    addRecordingIndicator();
    
    console.log('Recording started');
    return true;
  } catch (error) {
    console.error('Error starting recording:', error);
    return false;
  }
}

// Stop recording
function stopRecording() {
  if (!isRecording || !mediaRecorder) return;
  
  // Stop media recorder
  mediaRecorder.stop();
  
  // Stop all tracks in recording stream
  if (recordingStream) {
    recordingStream.getTracks().forEach(track => {
      if (track.readyState === 'live') {
        track.stop();
      }
    });
  }
  
  // Remove recording indicator
  removeRecordingIndicator();
  
  console.log('Recording stopped');
}

// Update UI to reflect recording state
function updateRecordingUI(isRecordingActive) {
  const recordBtn = document.getElementById('recordBtn');
  const stopRecordBtn = document.getElementById('stopRecordBtn');
  
  if (!recordBtn || !stopRecordBtn) return;
  
  if (isRecordingActive) {
    recordBtn.classList.add('recording');
    recordBtn.disabled = true;
    stopRecordBtn.disabled = false;
  } else {
    recordBtn.classList.remove('recording');
    recordBtn.disabled = false;
    stopRecordBtn.disabled = true;
  }
}

// Add recording indicator to UI
function addRecordingIndicator() {
  // Check if indicator already exists
  if (document.querySelector('.recording-indicator')) return;
  
  const indicator = document.createElement('div');
  indicator.className = 'recording-indicator';
  indicator.textContent = 'Recording';
  
  // Add to main content
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.appendChild(indicator);
  }
}

// Remove recording indicator from UI
function removeRecordingIndicator() {
  const indicator = document.querySelector('.recording-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Download the recording
async function downloadRecording(blob) {
  // Create a URL for the blob
  const url = URL.createObjectURL(blob);
  
  // Get current date for filename
  const now = new Date();
  const webmFilename = `darpan-recording-${now.toISOString().replace(/[:.]/g, '-')}.webm`;
  const mp4Filename = `darpan-recording-${now.toISOString().replace(/[:.]/g, '-')}.mp4`;
  
  // Add a popup for format selection
  showFormatSelectionPopup(url, webmFilename, blob, mp4Filename);
}

// Show popup to select download format
function showFormatSelectionPopup(webmUrl, webmFilename, webmBlob, mp4Filename) {
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.className = 'custom-popup-overlay';
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
  overlay.style.visibility = 'visible';
  
  // Create popup
  const popup = document.createElement('div');
  popup.className = 'custom-popup';
  
  // Updated popup with explanation about MP4 conversion limitations
  popup.innerHTML = `
    <div class="popup-header">
      <h3>Download Recording</h3>
    </div>
    <div class="popup-body">
      <p>Your recording is ready for download!</p>
      <div class="format-info">
        <p><strong>Note:</strong> MP4 conversion requires special server configuration. Currently only WebM format is available.</p>
      </div>
      <div id="conversion-status" class="conversion-container" style="display: none;">
        <p class="conversion-status">Converting to MP4... <span id="conversion-progress">0</span>%</p>
        <div class="conversion-progress-bar">
          <div id="progress-bar" class="conversion-progress-fill"></div>
        </div>
      </div>
    </div>
    <div class="popup-footer">
      <button id="webm-download-btn" class="popup-btn confirm-btn">
        <span class="material-icons">file_download</span>
        Download WebM Format
      </button>
    </div>
  `;
  
  // Add popup to overlay
  overlay.appendChild(popup);
  
  // Add overlay to body
  document.body.appendChild(overlay);
  
  // Handle WebM download button
  document.getElementById('webm-download-btn').addEventListener('click', () => {
    downloadFile(webmUrl, webmFilename);
    document.body.removeChild(overlay);
  });
}

// Convert WebM to MP4 using web service approach
async function convertWebmToMp4(webmBlob, progressCallback) {
  return new Promise(async (resolve, reject) => {
    try {
      // Load FFmpeg flag just to maintain code structure
      await loadFFmpeg();
      
      // We'll use direct blob download since conversion isn't working
      // This is a temporary solution - we'll fall back to WebM
      throw new Error('MP4 conversion requires secure context with HTTPS and specific security headers');
      
      // Note: In a production environment, you would implement one of these solutions:
      // 1. Server-side conversion API endpoint
      // 2. Configure server with proper security headers
      // 3. Use a Web Worker based conversion library
    } catch (error) {
      console.error('Conversion error:', error);
      reject(error);
    }
  });
}

// Helper function to download a file
function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  
  // Add to document, trigger click, then remove
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export {
  startRecording,
  stopRecording,
  isRecording
}; 