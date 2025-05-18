// Module for layout management of video grid and UI components
import { ensureVideoAspectRatio } from './utils.js';

// Update video container height based on header and controls visibility
function updateVideoContainerHeight() {
  // Get the visible height of header and controls
  const headerHeight = window.headerCollapsed ? 0 : (window.header.offsetHeight || 0);
  const controlsHeight = window.controlsCollapsed ? 0 : (window.controls.offsetHeight || 0);
  
  // Add padding for the header toggle button (it's fixed positioned)
  const topPadding = 30; // Height of the header toggle button
  
  // Calculate new max-height for videos container
  const newHeight = `calc(100vh - ${headerHeight + controlsHeight + topPadding}px)`;
  window.videosDiv.style.maxHeight = newHeight;
  
  // Add padding to the container for the toggle buttons
  window.videosDiv.style.paddingTop = window.headerCollapsed ? `${topPadding}px` : '0';
  // No bottom padding needed as control toggle is now at the right side
  window.videosDiv.style.paddingBottom = '0';
  
  // Also update pinned video container if in pinned mode
  if (window.mainContent.classList.contains("pinned-mode")) {
    const pinnedContainer = document.querySelector(".pinned-video-container");
    if (pinnedContainer) {
      pinnedContainer.style.maxHeight = newHeight;
      pinnedContainer.style.paddingTop = window.headerCollapsed ? `${topPadding}px` : '0';
      pinnedContainer.style.paddingBottom = '0';
    }
  }
  
  // Update grid layout after a short delay to let transitions complete
  setTimeout(updateGridLayout, 300);
}

// Improved function to update grid layout
function updateGridLayout() {
  const videoItems = document.querySelectorAll('.video-item:not([style*="display: none"])');
  const participantCount = videoItems.length;
  
  // Remove all grid classes
  window.videosDiv.classList.forEach(className => {
    if (className.startsWith('grid-')) {
      window.videosDiv.classList.remove(className);
    }
  });
  
  // Add the appropriate grid class based on participant count
  window.videosDiv.classList.add(`grid-${participantCount}`);
  
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

// Move other videos to sidebar, including the previously pinned video if there was one
function moveOtherVideosToSidebar(excludeVideoId) {
  // Clear sidebar first
  window.participantsSidebar.innerHTML = '';
  
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
}

// Move all videos back to the grid
function moveAllVideosToGrid() {
  // Remove all cloned videos from the sidebar
  window.participantsSidebar.innerHTML = '';
  
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
  if (window.screenSharingActive && !document.getElementById("local-screen-container")) {
    console.log("Recreating missing local screen share container in grid");
    
    // Create a container for the screen video
    const videoContainer = document.createElement("div");
    videoContainer.id = "local-screen-container";
    videoContainer.classList.add("video-item", "screen-share-container");
    
    // Create a local video element for screen preview
    const screenVideo = document.createElement("video");
    screenVideo.id = "local-screen";
    screenVideo.muted = true;
    screenVideo.srcObject = window.screenStream;
    screenVideo.autoplay = true;
    screenVideo.playsinline = true;
    screenVideo.classList.add("screen-share");
    
    // Add screen share icon
    const screenIcon = document.createElement("div");
    screenIcon.classList.add("screen-share-icon");
    screenIcon.innerHTML = '<span class="material-icons">screen_share</span>';
    
    // Create label
    const label = document.createElement("div");
    label.classList.add("user-label");
    label.textContent = "Your Screen";
    
    // Append elements
    videoContainer.appendChild(screenVideo);
    videoContainer.appendChild(label);
    videoContainer.appendChild(screenIcon);
    
    // Add to grid
    window.videosDiv.appendChild(videoContainer);
    
    console.log("Local screen share container successfully added to grid");
  }
  
  // Make sure to call updateGridLayout to refresh the grid
  setTimeout(() => {
    updateGridLayout();
  }, 50);
}

// Function to update the sidebar header with filter controls
function updateSidebarHeader(videoCount, screenShareCount) {
  // Clear existing header
  const existingHeader = window.participantsSidebar.querySelector('.sidebar-header');
  if (existingHeader) {
    existingHeader.remove();
  }
  
  if (videoCount + screenShareCount === 0) {
    // No videos to show
    const emptyMessage = document.createElement('div');
    emptyMessage.classList.add('empty-sidebar-message');
    emptyMessage.textContent = 'No other participants';
    
    // Add to the beginning of sidebar
    if (window.participantsSidebar.firstChild) {
      window.participantsSidebar.insertBefore(emptyMessage, window.participantsSidebar.firstChild);
    } else {
      window.participantsSidebar.appendChild(emptyMessage);
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
        const videoItems = window.participantsSidebar.querySelectorAll('.video-item');
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
  if (window.participantsSidebar.firstChild) {
    window.participantsSidebar.insertBefore(header, window.participantsSidebar.firstChild);
  } else {
    window.participantsSidebar.appendChild(header);
  }
}

// Helper function to create a sidebar video element
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
  
  // Import addPinButton from video-pin.js
  import('./video-pin.js').then(module => {
    // Add pin button to each video
    module.addPinButton(sidebarContainer, `sidebar-${videoId}`);
  });
  
  // Add to sidebar
  window.participantsSidebar.appendChild(sidebarContainer);
  
  // Play the video
  sidebarVideo.play().catch(e => console.error("Error playing sidebar video:", e));
}

// Function to check and restore videos that might have been hidden
function checkAndRestoreVideos() {
  // Check if local video is visible
  const localVideo = document.getElementById("local");
  const localContainer = document.getElementById("container-local");
  
  if (localVideo && (!localVideo.srcObject || !localVideo.srcObject.active)) {
    // Try to recreate the video stream
    navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }).then(stream => {
      localVideo.srcObject = stream;
      localVideo.play().catch(e => console.error("Error playing local video:", e));
      
      // Save the new localStream
      window.localStream = stream;
      
      // Save the video track
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        window.cameraVideoTrack = videoTracks[0];
      }
      
      // Make sure the container is visible
      if (localContainer) {
        localContainer.style.display = '';
      }
      
      console.log("Local video restored successfully");
    }).catch(err => {
      console.error("Failed to restore local video:", err);
    });
  } else if (localContainer && localContainer.style.display === 'none' && window.pinnedVideoId !== 'local') {
    // Make sure the container is visible even if the stream is active
    // But only if this isn't currently pinned
    localContainer.style.display = '';
    if (localVideo && localVideo.srcObject) {
      localVideo.play().catch(e => console.error("Error playing local video:", e));
    }
  }
  
  // Also check remote videos
  Object.keys(window.peers).forEach(userId => {
    const remoteVideo = document.getElementById(userId);
    const remoteContainer = document.getElementById(`container-${userId}`);
    
    if (remoteVideo && (!remoteVideo.srcObject || !remoteVideo.srcObject.active)) {
      // Make the container visible at least
      if (remoteContainer) {
        remoteContainer.style.display = '';
      }
    } else if (remoteContainer && remoteContainer.style.display === 'none' && window.pinnedVideoId !== userId) {
      // Make the container visible even if the stream is active
      // But only if this isn't currently pinned
      remoteContainer.style.display = '';
      if (remoteVideo && remoteVideo.srcObject) {
        remoteVideo.play().catch(e => console.error("Error playing remote video:", e));
      }
    }
  });
  
  // Check for local screen share
  if (window.screenSharingActive) {
    const localScreenVideo = document.getElementById("local-screen");
    const localScreenContainer = document.getElementById("local-screen-container");
    
    if (!localScreenVideo || !localScreenVideo.srcObject) {
      console.log("Recreating local screen video element");
      
      // If we have a valid screen stream, recreate the video element
      if (window.screenStream && window.screenStream.active) {
        if (!localScreenVideo) {
          const newScreenVideo = document.createElement("video");
          newScreenVideo.id = "local-screen";
          newScreenVideo.muted = true;
          newScreenVideo.srcObject = window.screenStream;
          newScreenVideo.autoplay = true;
          newScreenVideo.playsinline = true;
          newScreenVideo.classList.add("screen-share");
          
          if (localScreenContainer) {
            // Find any existing video and replace it
            const existingVideo = localScreenContainer.querySelector('video');
            if (existingVideo) {
              localScreenContainer.replaceChild(newScreenVideo, existingVideo);
            } else {
              localScreenContainer.prepend(newScreenVideo);
            }
          }
        } else {
          // Just update the srcObject
          localScreenVideo.srcObject = window.screenStream;
        }
      }
    }
    
    // Make sure screen container is visible when needed
    if (localScreenContainer && localScreenContainer.style.display === 'none' && window.pinnedVideoId !== 'local-screen') {
      // The screen share should be visible in grid mode but is hidden
      // Only display if it's not currently pinned
      localScreenContainer.style.display = '';
      
      // Make sure video is playing
      if (localScreenVideo && localScreenVideo.srcObject) {
        localScreenVideo.play().catch(e => console.error("Error playing local screen share:", e));
      }
      
      console.log("Local screen share restored to grid");
    } else if (!localScreenContainer && !window.pinnedVideoId && window.screenStream && window.screenStream.active) {
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
      screenVideo.srcObject = window.screenStream;
      screenVideo.autoplay = true;
      screenVideo.playsinline = true;
      screenVideo.classList.add("screen-share");
      
      // Add screen share icon
      const screenIcon = document.createElement("div");
      screenIcon.classList.add("screen-share-icon");
      screenIcon.innerHTML = '<span class="material-icons">screen_share</span>';
      
      // Create label
      const label = document.createElement("div");
      label.classList.add("user-label");
      label.textContent = "Your Screen";
      
      // Append elements
      videoContainer.appendChild(screenVideo);
      videoContainer.appendChild(label);
      videoContainer.appendChild(screenIcon);
      
      // Import addPinButton from video-pin.js
      import('./video-pin.js').then(module => {
        module.addPinButton(videoContainer, "local-screen");
      });
      
      // Add to grid
      window.videosDiv.appendChild(videoContainer);
      
      console.log("Local screen share container recreated");
    }
  }
  
  // Also check remote screen share containers if they exist
  const screenContainers = document.querySelectorAll('[id^="screen-container-"]');
  screenContainers.forEach(container => {
    // Get the container ID to find the corresponding video ID
    const containerIdParts = container.id.split('-');
    const userId = containerIdParts.slice(2).join('-');
    const videoId = `screen-${userId}`;
    
    if (container.style.display === 'none' && window.pinnedVideoId !== videoId) {
      // Only show if it's not currently pinned
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

// Set up periodic check to ensure videos stay visible
setInterval(checkAndRestoreVideos, 5000);

export {
  updateVideoContainerHeight,
  updateGridLayout,
  moveOtherVideosToSidebar,
  moveAllVideosToGrid,
  updateSidebarHeader,
  createSidebarVideo,
  checkAndRestoreVideos
}; 