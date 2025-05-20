// Raise hand functionality for the video conferencing app

// Global variables to track hand raise state
let handRaised = false;
const participantsWithRaisedHands = new Set();

/**
 * Initialize the raise hand feature
 */
export function initRaiseHand() {
  // Create UI elements if needed
  const raiseHandButton = document.getElementById('raiseHandBtn');
  
  // If button doesn't exist, log warning and return
  if (!raiseHandButton) {
    console.warn('Raise hand button not found in the DOM');
    return;
  }
  
  // Initialize UI state
  updateRaiseHandButtonState();
}

/**
 * Set up event listeners for the raise hand feature
 */
export function setupRaiseHandListeners() {
  console.log('Setting up raise hand listeners');
  
  // Get the raise hand button
  const raiseHandButton = document.getElementById('raiseHandBtn');
  
  // Add click listener to toggle hand raise state
  if (raiseHandButton) {
    console.log('Raise hand button found, adding event listener');
    raiseHandButton.addEventListener('click', toggleRaiseHand);
  } else {
    console.warn('Raise hand button not found in the DOM');
  }
  
  // Setup socket listeners for hand raise events
  if (window.socket) {
    console.log('Socket connection available, setting up hand raise socket listeners');
    
    // Remove any existing listeners to prevent duplicates
    window.socket.off('hand-raised', handlePeerRaisedHand);
    window.socket.off('hand-lowered', handlePeerLoweredHand);
    
    // Listen for hand raise events from other peers
    window.socket.on('hand-raised', handlePeerRaisedHand);
    
    // Listen for hand lowered events from other peers
    window.socket.on('hand-lowered', handlePeerLoweredHand);
    
    console.log('Hand raise socket listeners registered');
  } else {
    console.warn('Socket connection not available - cannot setup hand raise listeners');
  }
}

/**
 * Toggle the local user's hand raise state
 */
function toggleRaiseHand() {
  handRaised = !handRaised;
  console.log(`Hand raise toggled: ${handRaised}`);
  
  // Update the button state
  updateRaiseHandButtonState();
  
  // Emit appropriate event to peers
  if (window.socket) {
    try {
      if (handRaised) {
        window.socket.emit('raise-hand');
        console.log('Raise hand event emitted');
        
        // Show a confirmation message
        showHandRaiseConfirmation(true);
      } else {
        window.socket.emit('lower-hand');
        console.log('Lower hand event emitted');
        
        // Show a confirmation message
        showHandRaiseConfirmation(false);
      }
    } catch (error) {
      console.error('Error emitting hand raise event:', error);
    }
  } else {
    console.warn('Socket not available - cannot emit hand raise event');
  }
  
  // Add visual indicator to local video
  try {
    updateHandRaiseIndicator('local', handRaised);
    
    // Verify the indicator was added successfully
    const container = document.getElementById('localVideoContainer');
    const indicator = container ? container.querySelector('.hand-raised-indicator') : null;
    
    if (handRaised && !indicator) {
      console.warn('Hand indicator was not added to the DOM - attempting to add it directly');
      
      if (container) {
        const directIndicator = document.createElement('div');
        directIndicator.className = 'hand-raised-indicator';
        directIndicator.innerHTML = '<span class="material-icons">back_hand</span>';
        directIndicator.title = 'Your hand is raised';
        directIndicator.style.zIndex = '100';
        container.appendChild(directIndicator);
      }
    }
  } catch (error) {
    console.error('Error updating hand indicator:', error);
  }
}

/**
 * Show a brief confirmation message when the user raises/lowers their hand
 * @param {boolean} raised - Whether hand was raised or lowered
 */
function showHandRaiseConfirmation(raised) {
  // Create notification element if it doesn't exist
  let notification = document.querySelector('.local-hand-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.className = 'toast-notification local-hand-notification';
    
    // Add hand icon to the notification
    const icon = document.createElement('span');
    icon.className = 'material-icons notification-icon';
    icon.textContent = 'back_hand';
    notification.appendChild(icon);
    
    // Add text container
    const textContainer = document.createElement('div');
    textContainer.className = 'notification-text';
    notification.appendChild(textContainer);
    
    document.body.appendChild(notification);
  }
  
  // Set the message
  const textContainer = notification.querySelector('.notification-text');
  if (textContainer) {
    if (raised) {
      textContainer.innerHTML = '<strong>Hand Raised</strong><br>Others can now see your raised hand';
    } else {
      textContainer.innerHTML = '<strong>Hand Lowered</strong><br>Your hand is now lowered';
    }
  }
  
  // Style based on state
  notification.className = 'toast-notification local-hand-notification';
  if (raised) {
    notification.classList.add('hand-raised-state');
  } else {
    notification.classList.add('hand-lowered-state');
  }
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);
  
  // If hand is raised, keep a persistent indicator in the corner
  if (raised) {
    // Create or update persistent indicator
    let persistentIndicator = document.getElementById('persistent-hand-indicator');
    if (!persistentIndicator) {
      persistentIndicator = document.createElement('div');
      persistentIndicator.id = 'persistent-hand-indicator';
      persistentIndicator.className = 'persistent-hand-indicator';
      persistentIndicator.innerHTML = '<span class="material-icons">back_hand</span> Your hand is raised';
      
      // Add click handler to lower hand
      persistentIndicator.addEventListener('click', toggleRaiseHand);
      
      document.body.appendChild(persistentIndicator);
      
      // Animate in
      setTimeout(() => {
        persistentIndicator.classList.add('visible');
      }, 3000); // Show after the toast disappears
    }
  } else {
    // Remove persistent indicator if hand is lowered
    const persistentIndicator = document.getElementById('persistent-hand-indicator');
    if (persistentIndicator) {
      persistentIndicator.classList.remove('visible');
      setTimeout(() => {
        persistentIndicator.remove();
      }, 300);
    }
  }
  
  // Remove notification after delay
  setTimeout(() => {
    notification.classList.remove('visible');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000); // Show for 5 seconds instead of 3
}

/**
 * Update the raise hand button appearance based on current state
 */
function updateRaiseHandButtonState() {
  const raiseHandButton = document.getElementById('raiseHandBtn');
  if (!raiseHandButton) return;
  
  if (handRaised) {
    raiseHandButton.innerHTML = '<span class="material-icons control-icon">back_hand</span><span class="control-text">Lower Hand</span>';
    raiseHandButton.classList.add('active');
  } else {
    raiseHandButton.innerHTML = '<span class="material-icons control-icon">back_hand</span><span class="control-text">Raise Hand</span>';
    raiseHandButton.classList.remove('active');
  }
}

/**
 * Handle when a peer raises their hand
 * @param {Object} data - Contains peerId of user who raised hand
 */
function handlePeerRaisedHand(data) {
  console.log('Peer hand raise event received:', data);
  const { peerId } = data;
  
  if (!peerId) {
    console.error('Invalid peer hand raise data - missing peerId:', data);
    return;
  }
  
  // Add to the set of participants with raised hands
  participantsWithRaisedHands.add(peerId);
  console.log('Updated participants with raised hands:', [...participantsWithRaisedHands]);
  
  // Get user name for display
  const userName = data.userName || getUserDisplayName(peerId);
  
  // Update UI to show hand raised for this peer
  updateHandRaiseIndicator(peerId, true);
  
  // Add a hand raised badge to the user name label
  addHandRaisedBadgeToLabel(peerId);
  
  // Play a sound notification (optional)
  playHandRaiseSound();
  
  // Show a temporary notification
  showHandRaiseNotification(userName);
  
  // Double-check the indicator was created
  setTimeout(() => {
    const videoContainer = document.getElementById(`video-container-${peerId}`);
    if (videoContainer) {
      const indicator = videoContainer.querySelector('.hand-raised-indicator');
      if (!indicator) {
        console.warn(`Hand indicator not found for peer ${peerId} - recreating it`);
        const newIndicator = document.createElement('div');
        newIndicator.className = 'hand-raised-indicator peer-hand-indicator';
        newIndicator.innerHTML = '<span class="material-icons">back_hand</span>';
        newIndicator.title = `${userName} has raised their hand`;
        newIndicator.style.zIndex = '100';
        
        // Add animation
        newIndicator.style.animation = 'handPulse 2s infinite';
        
        videoContainer.appendChild(newIndicator);
        
        // Also check if this peer is in the sidebar (if in pinned mode)
        const sidebarContainer = document.getElementById(`sidebar-container-${peerId}`);
        if (sidebarContainer && !sidebarContainer.querySelector('.hand-raised-indicator')) {
          const sidebarIndicator = newIndicator.cloneNode(true);
          sidebarIndicator.classList.add('sidebar-hand-indicator');
          sidebarContainer.appendChild(sidebarIndicator);
        }
      }
    }
  }, 500); // Check after a short delay
}

/**
 * Get a display name for a peer based on their ID
 * @param {string} peerId - The peer's socket ID
 * @returns {string} A display name for the peer
 */
function getUserDisplayName(peerId) {
  // Check if this is the local user
  if (peerId === window.socket?.id) {
    return window.userDisplayName || `User ${peerId.substring(0, 5)}`;
  }
  
  // Try to find the name span in the video container
  const videoContainer = document.getElementById(`video-container-${peerId}`);
  if (videoContainer) {
    const label = videoContainer.querySelector('.user-label');
    if (label) {
      const nameSpan = label.querySelector('.name-text');
      if (nameSpan) {
        return nameSpan.textContent;
      }
      return label.textContent;
    }
  }
  
  // Fall back to a shortened ID if no name is found
  return `User ${peerId.substring(0, 5)}`;
}

/**
 * Add a hand raised badge to the user name label
 * @param {string} peerId - The peer's socket ID
 */
function addHandRaisedBadgeToLabel(peerId) {
  // Find the user label
  const videoContainer = document.getElementById(`video-container-${peerId}`);
  if (!videoContainer) return;
  
  const userLabel = videoContainer.querySelector('.user-label');
  if (!userLabel) return;
  
  // Check if badge already exists
  if (!userLabel.querySelector('.hand-badge')) {
    // Add a hand icon to the user label
    const handBadge = document.createElement('span');
    handBadge.className = 'hand-badge';
    handBadge.innerHTML = '<span class="material-icons">back_hand</span>';
    userLabel.appendChild(handBadge);
    
    // Highlight the label
    userLabel.classList.add('hand-raised-label');
  }
  
  // Do the same for sidebar if in pinned mode
  const sidebarContainer = document.getElementById(`sidebar-container-${peerId}`);
  if (sidebarContainer) {
    const sidebarLabel = sidebarContainer.querySelector('.user-label');
    if (sidebarLabel && !sidebarLabel.querySelector('.hand-badge')) {
      const handBadge = document.createElement('span');
      handBadge.className = 'hand-badge';
      handBadge.innerHTML = '<span class="material-icons">back_hand</span>';
      sidebarLabel.appendChild(handBadge);
      sidebarLabel.classList.add('hand-raised-label');
    }
  }
}

/**
 * Handle when a peer lowers their hand
 * @param {Object} data - Contains peerId of user who lowered hand
 */
function handlePeerLoweredHand(data) {
  console.log('Peer hand lower event received:', data);
  const { peerId } = data;
  
  if (!peerId) {
    console.error('Invalid peer hand lower data - missing peerId:', data);
    return;
  }
  
  // Remove from the set of participants with raised hands
  participantsWithRaisedHands.delete(peerId);
  console.log('Updated participants with raised hands:', [...participantsWithRaisedHands]);
  
  // Update UI to remove hand raised indicator for this peer
  updateHandRaiseIndicator(peerId, false);
  
  // Remove hand badge from user label
  removeHandRaisedBadgeFromLabel(peerId);
}

/**
 * Remove hand raised badge from the user name label
 * @param {string} peerId - The peer's socket ID
 */
function removeHandRaisedBadgeFromLabel(peerId) {
  // Find the user label
  const videoContainer = document.getElementById(`video-container-${peerId}`);
  if (!videoContainer) return;
  
  const userLabel = videoContainer.querySelector('.user-label');
  if (!userLabel) return;
  
  // Remove the hand badge if it exists
  const handBadge = userLabel.querySelector('.hand-badge');
  if (handBadge) {
    handBadge.remove();
  }
  
  // Remove the highlight class
  userLabel.classList.remove('hand-raised-label');
  
  // Do the same for sidebar if in pinned mode
  const sidebarContainer = document.getElementById(`sidebar-container-${peerId}`);
  if (sidebarContainer) {
    const sidebarLabel = sidebarContainer.querySelector('.user-label');
    if (sidebarLabel) {
      const sidebarBadge = sidebarLabel.querySelector('.hand-badge');
      if (sidebarBadge) {
        sidebarBadge.remove();
      }
      sidebarLabel.classList.remove('hand-raised-label');
    }
  }
}

/**
 * Update the visual hand raise indicator for a participant
 * @param {string} userId - ID of the user (peerId or 'local')
 * @param {boolean} isRaised - Whether the hand is raised
 */
function updateHandRaiseIndicator(userId, isRaised) {
  console.log(`Updating hand indicator for ${userId}, isRaised: ${isRaised}`);
  
  // Find the video container for this user
  const videoContainer = userId === 'local' 
    ? document.getElementById('localVideoContainer')
    : document.getElementById(`video-container-${userId}`);
  
  if (!videoContainer) {
    console.warn(`Video container not found for user ${userId}`);
    return;
  }
  
  // Check if indicator already exists
  let handIndicator = videoContainer.querySelector('.hand-raised-indicator');
  
  if (isRaised) {
    // Add indicator if it doesn't exist
    if (!handIndicator) {
      console.log(`Creating hand indicator for ${userId}`);
      handIndicator = document.createElement('div');
      handIndicator.className = 'hand-raised-indicator';
      handIndicator.innerHTML = '<span class="material-icons">back_hand</span>';
      
      // Add a title for accessibility and hover tooltip
      handIndicator.title = userId === 'local' ? 'Your hand is raised' : 'Hand raised';
      
      // Set explicit z-index to ensure visibility
      handIndicator.style.zIndex = '100';
      
      // Check for pin button or other top-right elements to avoid conflicts
      const pinButton = videoContainer.querySelector('.pin-button');
      if (pinButton) {
        // Position it with a bit more margin if pin button exists
        handIndicator.style.top = '50px';
      }
      
      // Add the indicator to the DOM
      videoContainer.appendChild(handIndicator);
      
      // Force a reflow for the element to ensure it's rendered correctly
      void handIndicator.offsetWidth;
      
      console.log(`Hand indicator created and added to container for ${userId}`);
    } else {
      console.log(`Hand indicator already exists for ${userId}`);
    }
  } else {
    // Remove indicator if it exists
    if (handIndicator) {
      console.log(`Removing hand indicator for ${userId}`);
      handIndicator.remove();
    }
  }
}

/**
 * Play a sound when someone raises their hand
 */
function playHandRaiseSound() {
  // Create an audio element for the notification sound
  const audio = new Audio('/sounds/hand-raise.mp3');
  
  // Check if sound exists and play it
  audio.oncanplaythrough = () => {
    audio.play().catch(error => {
      console.warn('Could not play hand raise sound:', error);
    });
  };
  
  audio.onerror = () => {
    console.warn('Hand raise sound file not found');
  };
}

/**
 * Show a temporary notification when someone raises their hand
 * @param {string} userName - Name of the user who raised their hand
 */
function showHandRaiseNotification(userName) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'toast-notification hand-raise-notification';
  notification.textContent = `${userName} raised their hand`;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    notification.classList.remove('visible');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
} 