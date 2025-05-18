// Module for utility functions

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

// Add event listeners to videos to ensure aspect ratio is maintained
function addVideoLoadedListener(videoElement) {
  videoElement.addEventListener('loadedmetadata', () => {
    ensureVideoAspectRatio(videoElement);
  });
}

// Helper function for screen reader announcements (accessibility)
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

// Helper to get container ID for a video ID
function getContainerIdForVideo(videoId) {
  // Check if this is a screen share videoId
  if (videoId === 'local-screen') {
    return 'local-screen-container';
  } else if (videoId.startsWith('screen-')) {
    return `screen-container-${videoId.substring(7)}`;
  } else {
    return `container-${videoId}`;
  }
}

// Helper to check if a videoId represents a screen share
function isScreenShareVideo(videoId) {
  return videoId === 'local-screen' || videoId.startsWith('screen-');
}

// Helper to get sidebar container ID for a video ID
function getSidebarContainerIdForVideo(videoId) {
  // Check if this is already a sidebar ID
  if (videoId.startsWith('sidebar-')) {
    return `sidebar-${getContainerIdForVideo(videoId.substring(8))}`;
  }
  
  return `sidebar-${getContainerIdForVideo(videoId)}`;
}

// Helper to get original videoId from a sidebar videoId
function getOriginalVideoId(videoId) {
  return videoId.startsWith('sidebar-') ? videoId.substring(8) : videoId;
}

// Export utility functions
export {
  ensureVideoAspectRatio,
  addVideoLoadedListener,
  announceToScreenReaders,
  getContainerIdForVideo,
  isScreenShareVideo,
  getSidebarContainerIdForVideo,
  getOriginalVideoId
}; 