// Module for video pinning functionality
import { moveOtherVideosToSidebar, moveAllVideosToGrid } from './layout.js';
import { announceToScreenReaders } from './utils.js';
import { addVideoLoadedListener } from './utils.js';

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

// Toggle pin/unpin for a video
function togglePinVideo(videoId) {
  // Check if this is a sidebar video (videoId will start with 'sidebar-')
  const isSidebarVideo = videoId.startsWith('sidebar-');
  
  // If it's a sidebar video, we need to get the real video ID
  const actualVideoId = isSidebarVideo ? videoId.substring(8) : videoId;
  
  if (window.pinnedVideoId === actualVideoId) {
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
      
      // Special case for local screen sharing
      if (actualVideoId === 'local-screen') {
        containerId = 'local-screen-container';
      } 
      // For remote screen shares
      else if (actualVideoId.startsWith('screen-')) {
        containerId = `screen-container-${actualVideoId.substring(7)}`;
      }
      // For regular videos
      else {
        containerId = `container-${actualVideoId}`;
      }
    } else {
      // Regular case - not from sidebar
      if (actualVideoId === 'local-screen') {
        containerId = 'local-screen-container';
      }
      else if (actualVideoId.startsWith('screen-')) {
        containerId = `screen-container-${actualVideoId.substring(7)}`;
      }
      else {
        containerId = `container-${actualVideoId}`;
      }
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

// Pin a specific video
function pinVideo(videoId) {
  // Handle the previously pinned video first if there is one
  const previouslyPinnedId = window.pinnedVideoId;
  
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
  window.mainContent.classList.add('pinned-mode');
  window.pinnedVideoId = videoId;
  
  // Check if this is a screen share
  const isScreenShare = videoId === 'local-screen' || videoId.startsWith('screen-');
  const isLocalScreenShare = videoId === 'local-screen';
  
  // Get the original video element to access its stream
  const originalVideoId = videoId.startsWith('screen-') ? videoId : videoId;
  const originalVideo = document.getElementById(originalVideoId);
  
  // Check if we got the original video - if not, might be a sidebar-prefixed ID
  if (!originalVideo || !originalVideo.srcObject) {
    // For local screen specifically, try the direct ID
    if (isLocalScreenShare) {
      const directVideo = document.getElementById('local-screen');
      if (directVideo && directVideo.srcObject) {
        originalVideo = directVideo;
      } else {
        console.error("Cannot pin video: local screen source not found");
        return;
      }
    } else {
      console.error("Cannot pin video: source not found");
      return;
    }
  }
  
  // Get the source stream
  const stream = originalVideo.srcObject;
  
  // For local screen share, make sure we save the stream for when we unpin
  if (isLocalScreenShare) {
    window.screenStream = stream;
  }
  
  // Find the container
  let videoContainer;
  
  if (isLocalScreenShare) {
    videoContainer = document.getElementById('local-screen-container');
  } else {
    videoContainer = document.getElementById(
      videoId.startsWith('screen-') ? `screen-container-${videoId.substring(7)}` : `container-${videoId}`
    );
  }
  
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
    if (videoId === 'local' || videoId === 'local-screen') {
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
    window.pinnedVideoWrapper.innerHTML = '';
    window.pinnedVideoWrapper.appendChild(pinnedContainer);
    
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
  if (!window.pinnedVideoId) return;
  
  // Save pinned ID before resetting it
  const prevPinnedId = window.pinnedVideoId;
  const isScreenShare = prevPinnedId === "local-screen" || prevPinnedId.startsWith("screen-");
  const isLocalScreenShare = prevPinnedId === "local-screen";
  
  // If we're unpinning local screen share, make sure we save the stream
  if (isLocalScreenShare) {
    const pinnedVideo = document.getElementById(`pinned-${prevPinnedId}`);
    if (pinnedVideo && pinnedVideo.srcObject && (!window.screenStream || !window.screenStream.active)) {
      console.log("Saving screen stream from pinned video");
      window.screenStream = pinnedVideo.srcObject;
    }
  }
  
  // Find the original container
  const videoId = window.pinnedVideoId;
  let originalContainerId;
  
  if (isLocalScreenShare) {
    originalContainerId = "local-screen-container";
  } else {
    originalContainerId = videoId.startsWith('screen-') 
      ? `screen-container-${videoId.substring(7)}` 
      : `container-${videoId}`;
  }
  
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
    
    // Ensure this original container has a pin button
    import('./video-pin.js').then(module => {
      module.addPinButton(originalContainer, videoId);
    });
  } else if (isLocalScreenShare && window.screenStream && window.screenStream.active) {
    // If we're unpinning a local screen share but the container is missing,
    // we need to recreate it
    console.log("Recreation of local screen container during unpin");
    
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
    
    // Add pin button
    addPinButton(videoContainer, "local-screen");
  }
  
  // Reset pinned video
  window.pinnedVideoId = null;
  window.pinnedVideoWrapper.innerHTML = '';
  
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
  window.mainContent.classList.remove('pinned-mode');
  
  // Announce for screen readers
  announceToScreenReaders("Video unpinned");
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
  if (!window.pinnedVideoId) return;
  
  // Get all sidebar videos
  const sidebarVideos = Array.from(window.participantsSidebar.querySelectorAll('.video-item'));
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
  if (window.pinnedVideoId.startsWith('screen-') || window.pinnedVideoId === 'local-screen') {
    // For screen shares
    currentIndex = pinnableIds.findIndex(id => 
      id === window.pinnedVideoId || 
      id === window.pinnedVideoId.replace('screen-', '')
    );
  } else {
    // For regular videos
    currentIndex = pinnableIds.findIndex(id => id === window.pinnedVideoId);
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

export {
  addPinButton,
  togglePinVideo,
  pinVideo,
  unpinVideo,
  addSwapViewButtons,
  swapPinnedView
}; 