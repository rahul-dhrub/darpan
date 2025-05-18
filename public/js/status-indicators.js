// Module for handling status indicators for audio and video
import { getOriginalVideoId } from './utils.js';

// Create status indicators for a user's container
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
  
  // Update status in pinned view if this user is pinned
  updatePinnedStatusIndicator(userId, 'mic', isOn);
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
  
  // Update status in pinned view if this user is pinned
  updatePinnedStatusIndicator(userId, 'video', isOn);
}

// Helper function to update status indicators in the pinned view
function updatePinnedStatusIndicator(userId, type, isOn) {
  // Check if this user's video is currently pinned
  if (window.pinnedVideoId) {
    const pinnedUserId = getOriginalVideoId(window.pinnedVideoId);
    
    if (pinnedUserId === userId) {
      // Find the pinned container and update the status indicator
      const pinnedContainer = document.querySelector(`[id^="pinned-container-"], [id^="pinned-screen-container-"]`);
      if (pinnedContainer) {
        const statusIndicator = pinnedContainer.querySelector(type === 'mic' ? '.mic-status' : '.video-status');
        if (statusIndicator) {
          if (isOn) {
            statusIndicator.innerHTML = `<span class="material-icons">${type === 'mic' ? 'mic' : 'videocam'}</span>`;
            statusIndicator.classList.remove('status-off');
            statusIndicator.title = type === 'mic' ? 'Microphone is on' : 'Camera is on';
          } else {
            statusIndicator.innerHTML = `<span class="material-icons">${type === 'mic' ? 'mic_off' : 'videocam_off'}</span>`;
            statusIndicator.classList.add('status-off');
            statusIndicator.title = type === 'mic' ? 'Microphone is off' : 'Camera is off';
          }
        }
      }
    }
  }
}

// Set up CSS style for status indicators dynamically
function addStatusIndicatorStyles() {
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
}

// Add styles when this module loads
addStatusIndicatorStyles();

export {
  addStatusIndicators,
  updatePeerMicStatus,
  updatePeerVideoStatus
}; 