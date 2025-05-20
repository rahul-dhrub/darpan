// Debug helper script for WebRTC peer connections

// Monitor connections
export function monitorPeerConnections() {
  console.log("Debug monitoring started");
  
  // Monitor peer connections
  setInterval(() => {
    // Log the number of peer connections
    const peerCount = Object.keys(window.peers || {}).length;
    console.log(`Current peer connections: ${peerCount}`);
    
    // Check ICE connection state for each peer
    if (window.peers) {
      Object.entries(window.peers).forEach(([peerId, peerConnection]) => {
        console.log(`Peer ${peerId} - ICE state: ${peerConnection.iceConnectionState}, signaling state: ${peerConnection.signalingState}`);
        
        // Log tracks on this peer connection
        const senders = peerConnection.getSenders();
        console.log(`  Outgoing tracks: ${senders.length}`);
        senders.forEach(sender => {
          if (sender.track) {
            console.log(`  - Outgoing ${sender.track.kind} track: ${sender.track.enabled ? 'enabled' : 'disabled'}`);
          }
        });
        
        const receivers = peerConnection.getReceivers();
        console.log(`  Incoming tracks: ${receivers.length}`);
        receivers.forEach(receiver => {
          if (receiver.track) {
            console.log(`  - Incoming ${receiver.track.kind} track: ${receiver.track.enabled ? 'enabled' : 'disabled'}`);
          }
        });
      });
    }
    
    // Log socket connected state
    if (window.socket) {
      console.log(`Socket connected: ${window.socket.connected}, id: ${window.socket.id}`);
    }
    
    // Log video elements in DOM
    const videoElements = document.querySelectorAll('video');
    console.log(`Video elements in DOM: ${videoElements.length}`);
    videoElements.forEach(video => {
      console.log(`  - Video #${video.id}: ${video.srcObject ? 'has stream' : 'no stream'}, ${video.paused ? 'paused' : 'playing'}`);
      if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        console.log(`    Tracks: ${tracks.length} (${tracks.map(t => t.kind).join(', ')})`);
      }
    });
    
    // Check room ID
    console.log(`Room ID: ${window.ROOM_ID}`);
    
  }, 5000); // Log every 5 seconds
}

// Helper to show detailed connection stats
export function getConnectionStats(peerId) {
  if (!window.peers || !window.peers[peerId]) {
    console.error(`No peer connection found for ID: ${peerId}`);
    return;
  }
  
  const peer = window.peers[peerId];
  peer.getStats(null).then(stats => {
    let output = `Stats for peer ${peerId}:\n`;
    stats.forEach(report => {
      output += `Report: ${report.type}\n`;
      Object.keys(report).forEach(key => {
        if (key !== "type" && key !== "id" && key !== "timestamp") {
          output += `  ${key}: ${report[key]}\n`;
        }
      });
    });
    console.log(output);
  });
}

// Fix for invalid video container IDs
export function fixVideoContainerIds() {
  // Check for wrong ID format and fix
  const containers = document.querySelectorAll('div[id^="container-"]');
  containers.forEach(container => {
    if (container.id.startsWith('container-')) {
      const peerId = container.id.replace('container-', '');
      const newId = `video-container-${peerId}`;
      console.log(`Fixing container ID from ${container.id} to ${newId}`);
      container.id = newId;
    }
  });
  
  // Also check for missing "video-" in IDs
  const peerContainers = document.querySelectorAll('div.video-item');
  peerContainers.forEach(container => {
    if (container.id && !container.id.includes('video-container-') && !container.id.includes('screen-container-') && container.id !== 'localVideoContainer') {
      const oldId = container.id;
      container.id = `video-container-${oldId}`;
      console.log(`Fixed container ID from ${oldId} to ${container.id}`);
    }
  });
} 