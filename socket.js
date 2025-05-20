// Handle name updates from other users
window.socket.on("name-update", data => {
  console.log(`Name update received for user ${data.userId}: ${data.name}`);
  
  // Update the user's name in the UI
  updatePeerDisplayName(data.userId, data.name);
}); 