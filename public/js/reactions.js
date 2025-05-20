// Module for emoji reactions

// Track the state of the reactions panel
let reactionsPanelVisible = false;

// Initialize the emoji reactions container
function initReactions() {
  // Create container for floating emojis if it doesn't exist
  if (!document.querySelector('.floating-emoji-container')) {
    const container = document.createElement('div');
    container.className = 'floating-emoji-container';
    document.body.appendChild(container);
  }
}

// Toggle the reactions panel
function toggleReactionsPanel() {
  const reactionsPanel = document.getElementById('reactionsPanel');
  const reactionsBtn = document.getElementById('reactionsBtn');
  
  if (!reactionsPanel || !reactionsBtn) return;
  
  reactionsPanelVisible = !reactionsPanelVisible;
  reactionsPanel.classList.toggle('visible', reactionsPanelVisible);
  reactionsBtn.classList.toggle('active', reactionsPanelVisible);
}

// Close the reactions panel
function closeReactionsPanel() {
  const reactionsPanel = document.getElementById('reactionsPanel');
  const reactionsBtn = document.getElementById('reactionsBtn');
  
  if (!reactionsPanel || !reactionsBtn) return;
  
  reactionsPanelVisible = false;
  reactionsPanel.classList.remove('visible');
  reactionsBtn.classList.remove('active');
}

// Send a reaction
function sendReaction(emoji) {
  // Display the emoji locally
  showFloatingEmoji(emoji);
  
  // Send the emoji to other participants
  if (window.socket) {
    window.socket.emit('reaction', {
      room: window.ROOM_ID,
      emoji: emoji
    });
  }
  
  // Close the panel after sending
  closeReactionsPanel();
}

// Show a floating emoji animation
function showFloatingEmoji(emoji) {
  const container = document.querySelector('.floating-emoji-container');
  if (!container) return;
  
  // Create a new floating emoji element
  const emojiElement = document.createElement('div');
  emojiElement.className = 'floating-emoji';
  emojiElement.textContent = emoji;
  
  // Add slight random positioning
  const randomOffset = Math.floor(Math.random() * 40) - 20;
  emojiElement.style.right = `${40 + randomOffset}px`;
  
  // Add to container
  container.appendChild(emojiElement);
  
  // Remove element after animation completes
  setTimeout(() => {
    if (emojiElement.parentNode === container) {
      container.removeChild(emojiElement);
    }
  }, 3200); // Slightly longer than the animation duration
}

// Setup event listeners for reactions
function setupReactionsListeners() {
  const reactionsBtn = document.getElementById('reactionsBtn');
  const reactionsPanelClose = document.getElementById('reactionsPanelClose');
  const reactionButtons = document.querySelectorAll('.reaction-btn');
  
  if (reactionsBtn) {
    reactionsBtn.addEventListener('click', toggleReactionsPanel);
  }
  
  if (reactionsPanelClose) {
    reactionsPanelClose.addEventListener('click', closeReactionsPanel);
  }
  
  // Add event listeners to all reaction buttons
  reactionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const emoji = button.getAttribute('data-emoji');
      if (emoji) {
        sendReaction(emoji);
      }
    });
  });
  
  // Handle incoming reactions from other participants
  if (window.socket) {
    window.socket.on('reaction', (data) => {
      if (data && data.emoji) {
        showFloatingEmoji(data.emoji);
      }
    });
  }
}

// Export functions
export {
  initReactions,
  setupReactionsListeners,
  toggleReactionsPanel,
  closeReactionsPanel,
  showFloatingEmoji
}; 