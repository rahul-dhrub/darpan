document.addEventListener('DOMContentLoaded', () => {
  const meetingLinkContainer = document.getElementById('meetingLinkContainer');
  const meetingLinkInput = document.getElementById('meetingLinkInput');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const copyConfirmation = document.getElementById('copyConfirmation');
  let generatedRoomId = null;
  
  // Initialize UI based on login status (login state is passed from server)
  function initializeUI() {
    // Login status is already handled by EJS templating
    console.log('UI initialized with login status');
    
    // Apply avatar background color from data attribute
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
      const bgColor = userAvatar.getAttribute('data-bg-color');
      console.log('User avatar found, setting background color:', bgColor);
      if (bgColor) {
        userAvatar.style.backgroundColor = bgColor;
      } else {
        console.log('No data-bg-color attribute found on user avatar');
      }
    } else {
      console.log('No user avatar element found');
    }
  }
  
  // Call initializeUI on page load
  initializeUI();
  
  // Create meeting button
  document.getElementById('createMeetingBtn').addEventListener('click', () => {
    // Generate a random room ID
    generatedRoomId = generateRoomId();
    joinRoom(generatedRoomId);
  });
  
  // Create meeting link button
  document.getElementById('createLinkBtn').addEventListener('click', () => {
    // Generate a random room ID if not already generated
    generatedRoomId = generateRoomId();
    
    // Show meeting link container
    meetingLinkContainer.style.display = 'block';
    
    // Generate the full meeting URL
    const meetingLink = generateMeetingLink(generatedRoomId);
    
    // Set the link in the input field
    meetingLinkInput.value = meetingLink;
  });
  
  // Copy link button
  copyLinkBtn.addEventListener('click', () => {
    // Select the text in the input
    meetingLinkInput.select();
    meetingLinkInput.setSelectionRange(0, 99999); // For mobile devices
    
    try {
      // Copy the text to clipboard
      navigator.clipboard.writeText(meetingLinkInput.value)
        .then(() => {
          // Show confirmation
          copyConfirmation.style.display = 'block';
          
          // Hide confirmation after 3 seconds
          setTimeout(() => {
            copyConfirmation.style.display = 'none';
          }, 3000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
          // Fallback if clipboard API fails
          document.execCommand('copy');
          copyConfirmation.style.display = 'block';
          setTimeout(() => {
            copyConfirmation.style.display = 'none';
          }, 3000);
        });
    } catch (err) {
      console.error('Clipboard API not available: ', err);
      // Older browser support
      document.execCommand('copy');
      copyConfirmation.style.display = 'block';
      setTimeout(() => {
        copyConfirmation.style.display = 'none';
      }, 3000);
    }
  });
  
  // Join meeting button
  document.getElementById('joinMeetingBtn').addEventListener('click', () => {
    const roomId = document.getElementById('roomIdInput').value.trim();
    if (roomId) {
      joinRoom(roomId);
    } else {
      alert('Please enter a valid room code');
    }
  });
  
  // Allow joining with Enter key
  document.getElementById('roomIdInput').addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      document.getElementById('joinMeetingBtn').click();
    }
  });
  
  // Generate a random room ID
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 12);
  }
  
  // Generate a full meeting link from a room ID
  function generateMeetingLink(roomId) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/device-preview?room=${roomId}`;
  }
  
  // Join the specified room
  function joinRoom(roomId) {
    window.location.href = `/device-preview?room=${roomId}`;
  }
}); 