// Module for handling the menu and its functionality
let menuVisible = false;
let isFullscreen = false;

// Initialize menu feature
function initMenu() {
  setupMenuElements();
  setupMenuListeners();
}

// Setup menu DOM elements
function setupMenuElements() {
  window.menuBtn = document.getElementById("menuBtn");
  window.menuPanel = document.getElementById("menuPanel");
  window.menuPanelClose = document.getElementById("menuPanelClose");
  window.fullscreenBtn = document.getElementById("fullscreenBtn");
}

// Setup menu event listeners
function setupMenuListeners() {
  // Toggle menu panel when menu button is clicked
  window.menuBtn.addEventListener("click", () => {
    toggleMenuPanel();
  });

  // Close menu panel when close button is clicked
  window.menuPanelClose.addEventListener("click", () => {
    hideMenuPanel();
  });

  // Handle fullscreen toggle
  window.fullscreenBtn.addEventListener("click", () => {
    toggleFullscreen();
  });

  // Listen for fullscreen change events
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}

// Toggle menu panel visibility
function toggleMenuPanel() {
  menuVisible = !menuVisible;
  window.menuPanel.classList.toggle("visible", menuVisible);
  window.menuBtn.classList.toggle("active", menuVisible);
}

// Hide menu panel
function hideMenuPanel() {
  menuVisible = false;
  window.menuPanel.classList.remove("visible");
  window.menuBtn.classList.remove("active");
}

// Toggle fullscreen mode
function toggleFullscreen() {
  if (!isFullscreen) {
    // Enter fullscreen
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

// Handle fullscreen change events
function handleFullscreenChange() {
  isFullscreen = Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );

  // Update fullscreen button text and icon
  if (window.fullscreenBtn) {
    window.fullscreenBtn.innerHTML = isFullscreen ?
      '<span class="material-icons">fullscreen_exit</span><span>Exit Fullscreen</span>' :
      '<span class="material-icons">fullscreen</span><span>Enter Fullscreen</span>';
  }

  // Update body class for styling
  document.body.classList.toggle('fullscreen-active', isFullscreen);

  // Update grid layout if needed
  if (typeof updateGridLayout === 'function') {
    updateGridLayout();
  }
}

// Close menu panel when clicking outside
document.addEventListener('click', (event) => {
  if (menuVisible &&
      !window.menuBtn.contains(event.target) &&
      !window.menuPanel.contains(event.target)) {
    hideMenuPanel();
  }
});

// Export functions
export {
  initMenu,
  setupMenuListeners,
  toggleFullscreen
}; 