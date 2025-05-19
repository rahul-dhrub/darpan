// Module for handling UI elements and interactions
import { updateVideoContainerHeight, updateGridLayout } from './layout.js';
import { startScreenSharing, stopScreenSharing } from './screen-share.js';
import { addMessage } from './socket.js';

// Function to initialize all UI elements
function setupUIElements() {
  // Store references to DOM elements in window for global access
  window.screenShareBtn = document.getElementById("screenShareBtn");
  window.stopScreenShareBtn = document.getElementById("stopScreenShareBtn");
  window.muteBtn = document.getElementById("muteBtn");
  window.videoBtn = document.getElementById("videoBtn");
  window.leaveBtn = document.getElementById("leaveBtn");
  window.chatToggleBtn = document.getElementById("chatToggleBtn");
  window.chatCollapseBtn = document.getElementById("chatCollapseBtn");
  window.sidebar = document.getElementById("sidebar");
  window.chatInput = document.getElementById("chatInput");
  window.sendBtn = document.getElementById("sendBtn");
  window.chatMessages = document.getElementById("chatMessages");
  window.pinnedVideoWrapper = document.getElementById("pinnedVideoWrapper");
  window.participantsSidebar = document.getElementById("participantsSidebar");
  window.mainContent = document.querySelector(".main-content");
  window.meetingTimeElement = document.getElementById("meetingTime");
  window.participantCountElement = document.getElementById("participantCount");
  window.headerToggle = document.getElementById("headerToggle");
  window.controlsToggle = document.getElementById("controlsToggle");
  window.header = document.querySelector(".header");
  window.controls = document.querySelector(".controls");
  window.controlsContainer = document.querySelector(".controls-container");
}

// Setup all UI event listeners
function setupUIEventListeners() {
  // Toggle header (navbar) when the toggle button is clicked
  window.headerToggle.addEventListener("click", () => {
    window.headerCollapsed = !window.headerCollapsed;
    window.header.classList.toggle("collapsed", window.headerCollapsed);
    
    // Update the icon direction
    const icon = window.headerToggle.querySelector(".material-icons");
    icon.textContent = window.headerCollapsed ? "expand_less" : "expand_more";
    
    // Position the toggle button
    if (window.headerCollapsed) {
      window.headerToggle.style.top = "0px";
    } else {
      // Let it be positioned by CSS
      window.headerToggle.style.top = "";
    }
    
    // Update videos container height
    updateVideoContainerHeight();
  });

  // Toggle controls when the toggle button is clicked
  window.controlsToggle.addEventListener("click", () => {
    window.controlsCollapsed = !window.controlsCollapsed;
    window.controls.classList.toggle("collapsed", window.controlsCollapsed);
    window.controlsToggle.classList.toggle("collapsed", window.controlsCollapsed);
    
    // Update the icon direction
    const icon = window.controlsToggle.querySelector(".material-icons");
    icon.textContent = window.controlsCollapsed ? "expand_less" : "expand_more";
    
    // Position the toggle button
    if (window.controlsCollapsed) {
      window.controlsToggle.style.bottom = "0px";
      // Make sure controls-container doesn't collapse
      if (window.controlsContainer) {
        window.controlsContainer.style.height = window.controlsToggle.offsetHeight + "px";
        window.controlsContainer.classList.add("collapsed");
      }
    } else {
      // Let it be positioned by CSS
      window.controlsToggle.style.bottom = "";
      // Reset container height
      if (window.controlsContainer) {
        window.controlsContainer.style.height = "";
        window.controlsContainer.classList.remove("collapsed");
      }
    }
    
    // Update videos container height
    updateVideoContainerHeight();
  });

  // Leave meeting
  window.leaveBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to leave the meeting?")) {
      // Calculate meeting duration in seconds
      const meetingDuration = Math.floor((Date.now() - window.meetingStartTime) / 1000);
      
      if (window.localStream) {
        window.localStream.getTracks().forEach(track => track.stop());
      }
      if (window.screenSharingActive) {
        stopScreenSharing();
      }
      window.socket.disconnect();
      
      // Redirect to rating page with meeting duration and room ID
      window.location.href = `/rating.html?duration=${meetingDuration}&room=${window.ROOM_ID}`;
    }
  });

  // Toggle chat sidebar
  window.chatToggleBtn.addEventListener("click", () => {
    window.chatVisible = !window.chatVisible;
    window.sidebar.classList.toggle("sidebar-hidden", !window.chatVisible);
    window.chatToggleBtn.classList.toggle('active', window.chatVisible);
  });

  // Collapse chat sidebar from within
  window.chatCollapseBtn.addEventListener("click", () => {
    window.chatVisible = false;
    window.sidebar.classList.add("sidebar-hidden");
    window.chatToggleBtn.classList.remove('active');
  });

  // Chat functionality
  window.sendBtn.addEventListener("click", sendMessage);
  window.chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Screen sharing button
  window.screenShareBtn.addEventListener("click", startScreenSharing);
  
  // Stop screen sharing button
  window.stopScreenShareBtn.addEventListener("click", () => {
    // Add visual feedback
    window.stopScreenShareBtn.classList.add('stopping');
    
    // Announce to screen readers
    import('./utils.js').then(module => {
      module.announceToScreenReaders("Stopping screen sharing");
    });
    
    // Stop screen sharing
    stopScreenSharing();
    
    // Remove visual feedback after a short delay
    setTimeout(() => {
      window.stopScreenShareBtn.classList.remove('stopping');
    }, 500);
  });
}

// Initialize meeting UI components
function initMeetingUI() {
  startMeetingTimer();
  updateParticipantCount();
}

// Start meeting timer
function startMeetingTimer() {
  // Initialize with current time
  updateMeetingTimer();
  
  // Update timer every second
  window.meetingTimerInterval = setInterval(updateMeetingTimer, 1000);
}

// Update the meeting timer display
function updateMeetingTimer() {
  const elapsedTime = Date.now() - window.meetingStartTime;
  const seconds = Math.floor((elapsedTime / 1000) % 60);
  const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
  const hours = Math.floor((elapsedTime / (1000 * 60 * 60)));
  
  window.meetingTimeElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Update participant count in the UI
function updateParticipantCount() {
  // Make sure we have the element before trying to update it
  if (window.participantCountElement) {
    // Ensure we never show less than 1 participant
    window.totalParticipants = Math.max(1, window.totalParticipants);
    
    // Get the current displayed count
    const currentDisplayed = parseInt(window.participantCountElement.textContent) || 0;
    
    // Only update if changed (to trigger animation only when needed)
    if (currentDisplayed !== window.totalParticipants) {
      // Add animation class
      window.participantCountElement.classList.add('count-change');
      
      // Update the participant count display
      window.participantCountElement.textContent = window.totalParticipants.toString();
      
      // Log for debugging
      console.log(`Updated participant count to: ${window.totalParticipants}`);
      
      // Remove animation class after animation completes
      setTimeout(() => {
        window.participantCountElement.classList.remove('count-change');
      }, 500);
    }
  }
}

// Send chat message
function sendMessage() {
  const message = window.chatInput.value.trim();
  if (message) {
    window.socket.emit("chat-message", {
      room: window.ROOM_ID,
      message,
      sender: window.socket.id
    });
    
    addMessage(message, "You", true);
    window.chatInput.value = "";
  }
}

export {
  setupUIElements,
  setupUIEventListeners,
  initMeetingUI,
  updateParticipantCount,
  sendMessage
}; 