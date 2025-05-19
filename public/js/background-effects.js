// Module for background effects using BodyPix segmentation
let bodypixModel = null;
let backgroundImage = null;
let currentEffect = 'none'; // 'none', 'blur', 'image', 'color'
let backgroundImageURL = null;
let backgroundColor = 'rgb(0, 128, 0)'; // Default background color
let blurRadius = 15; // Blur effect radius (now controls opacity level)

// Canvas elements for processing
let outputCanvas = null;
let processCanvas = null;
let processCtx = null;
let outputCtx = null;

// New variables for translucent layers
let translucentCanvas1 = null;
let translucentCanvas2 = null;
let translucentCanvas3 = null;
let translucentCtx1 = null;
let translucentCtx2 = null;
let translucentCtx3 = null;

// Load the BodyPix model
async function loadBodyPixModel() {
  if (!bodypixModel) {
    console.log('Loading BodyPix model...');
    try {
      bodypixModel = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
      console.log('BodyPix model loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading BodyPix model:', error);
      return false;
    }
  }
  return true;
}

// Initialize background effects processing
async function initBackgroundEffects(videoElement, canvasElement) {
  // Make sure the model is loaded
  const modelLoaded = await loadBodyPixModel();
  if (!modelLoaded) {
    console.error('Failed to load BodyPix model');
    return false;
  }
  
  // Set up the output canvas where the final video will be displayed
  outputCanvas = canvasElement;
  outputCtx = outputCanvas.getContext('2d');
  
  // Create a processing canvas (not visible in the DOM)
  processCanvas = document.createElement('canvas');
  processCtx = processCanvas.getContext('2d');
  
  // Create translucent layer canvases
  translucentCanvas1 = document.createElement('canvas');
  translucentCanvas2 = document.createElement('canvas');
  translucentCanvas3 = document.createElement('canvas');
  translucentCtx1 = translucentCanvas1.getContext('2d');
  translucentCtx2 = translucentCanvas2.getContext('2d');
  translucentCtx3 = translucentCanvas3.getContext('2d');
  
  // Set canvas dimensions to match video
  const setCanvasDimensions = () => {
    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;
    
    if (width && height) {
      processCanvas.width = width;
      processCanvas.height = height;
      outputCanvas.width = width;
      outputCanvas.height = height;
      
      // Set dimensions for translucent canvases
      translucentCanvas1.width = width;
      translucentCanvas1.height = height;
      translucentCanvas2.width = width;
      translucentCanvas2.height = height;
      translucentCanvas3.width = width;
      translucentCanvas3.height = height;
    }
  };
  
  // Set initial dimensions
  if (videoElement.videoWidth) {
    setCanvasDimensions();
  } else {
    // Wait for video metadata to load
    videoElement.addEventListener('loadedmetadata', setCanvasDimensions);
  }
  
  return true;
}

// Process a frame with the selected background effect
async function processFrame(videoElement) {
  if (!bodypixModel || !outputCanvas || !processCanvas || currentEffect === 'none') {
    // If no effect is selected or model not loaded, just draw the video
    if (outputCtx && videoElement.videoWidth > 0) {
      outputCtx.drawImage(videoElement, 0, 0, outputCanvas.width, outputCanvas.height);
    }
    return;
  }
  
  try {
    // Run segmentation
    const segmentation = await bodypixModel.segmentPerson(videoElement, {
      flipHorizontal: false,
      internalResolution: 'medium',
      segmentationThreshold: 0.7,
      maxDetections: 1
    });
    
    // Draw the frame to the processing canvas
    processCtx.drawImage(videoElement, 0, 0, processCanvas.width, processCanvas.height);
    
    // Apply the selected effect
    switch (currentEffect) {
      case 'blur':
        applyBlurEffect(segmentation);
        break;
      case 'image':
        applyImageBackground(segmentation);
        break;
      case 'color':
        applyColorBackground(segmentation);
        break;
      default:
        // No effect, just copy the processed frame
        outputCtx.drawImage(processCanvas, 0, 0);
    }
  } catch (error) {
    console.error('Error processing video frame:', error);
    // Fallback - just display the video without effects
    if (outputCtx && videoElement.videoWidth > 0) {
      outputCtx.drawImage(videoElement, 0, 0, outputCanvas.width, outputCanvas.height);
    }
  }
}

// Apply blur effect to the background - New implementation with translucent layers
function applyBlurEffect(segmentation) {
  // Get dimensions
  const width = processCanvas.width;
  const height = processCanvas.height;
  
  // Get the original frame
  const originalFrame = processCtx.getImageData(0, 0, width, height);
  
  // Clear all canvases
  outputCtx.clearRect(0, 0, width, height);
  translucentCtx1.clearRect(0, 0, width, height);
  translucentCtx2.clearRect(0, 0, width, height);
  translucentCtx3.clearRect(0, 0, width, height);
  
  // Draw the original frame to all canvases
  translucentCtx1.drawImage(processCanvas, 0, 0);
  translucentCtx2.drawImage(processCanvas, 0, 0);
  translucentCtx3.drawImage(processCanvas, 0, 0);
  
  // Apply different opacity levels to each canvas
  // The blurRadius now controls the base opacity level
  const baseOpacity = Math.min(0.9, Math.max(0.1, blurRadius / 50)); // Convert radius to opacity (0.1 to 0.9)
  
  // Create translucent layers
  const layer1 = translucentCtx1.getImageData(0, 0, width, height);
  const layer2 = translucentCtx2.getImageData(0, 0, width, height);
  const layer3 = translucentCtx3.getImageData(0, 0, width, height);
  
  // Add translucent effect to different regions based on distance from person
  const { data: segmentationData } = segmentation;
  
  // First pass - identify distance from person
  const distanceMap = new Uint8Array(segmentationData.length);
  
  // Initialize with high values
  for (let i = 0; i < segmentationData.length; i++) {
    if (segmentationData[i] === 0) { // Background pixel
      distanceMap[i] = 255; // Max distance initially
    } else {
      distanceMap[i] = 0; // Person pixels have zero distance
    }
  }
  
  // Simple distance calculation (just checking immediate neighbors)
  // This is a simplified version - a full distance transform would be more accurate but slower
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (segmentationData[idx] === 0) { // Background pixel
        // Check if any neighbor is part of a person
        if (segmentationData[idx - 1] === 1 || // left
            segmentationData[idx + 1] === 1 || // right
            segmentationData[idx - width] === 1 || // top
            segmentationData[idx + width] === 1) { // bottom
          distanceMap[idx] = 1; // Adjacent to person
        }
      }
    }
  }
  
  // Second pass - extend the distance map further
  const distanceMap2 = new Uint8Array(distanceMap);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (distanceMap[idx] === 1) { // Pixels adjacent to person
        // Mark their neighbors
        if (distanceMap2[idx - 1] > 1) distanceMap2[idx - 1] = 2;
        if (distanceMap2[idx + 1] > 1) distanceMap2[idx + 1] = 2;
        if (distanceMap2[idx - width] > 1) distanceMap2[idx - width] = 2;
        if (distanceMap2[idx + width] > 1) distanceMap2[idx + width] = 2;
      }
    }
  }
  
  // Create a composite image with 3 levels of transparency
  const compositeFrame = new ImageData(new Uint8ClampedArray(originalFrame.data), width, height);
  
  for (let i = 0; i < segmentationData.length; i++) {
    const j = i * 4; // RGBA
    
    if (segmentationData[i] === 1) {
      // Person - keep original
      compositeFrame.data[j] = originalFrame.data[j];
      compositeFrame.data[j + 1] = originalFrame.data[j + 1];
      compositeFrame.data[j + 2] = originalFrame.data[j + 2];
      compositeFrame.data[j + 3] = originalFrame.data[j + 3];
    } else {
      // Background - apply translucent effect based on distance
      // Level 1 - closest to person (less transparent)
      if (distanceMap[i] === 1) {
        compositeFrame.data[j + 3] = Math.floor(255 * (1 - baseOpacity * 0.7)); // Alpha channel
      } 
      // Level 2 - medium distance
      else if (distanceMap2[i] === 2) {
        compositeFrame.data[j + 3] = Math.floor(255 * (1 - baseOpacity * 0.85)); // Alpha channel
      } 
      // Level 3 - furthest (most transparent)
      else {
        compositeFrame.data[j + 3] = Math.floor(255 * (1 - baseOpacity)); // Alpha channel
      }
    }
  }
  
  // Draw the original video first
  outputCtx.drawImage(processCanvas, 0, 0);
  
  // Apply a semi-transparent gray background
  outputCtx.fillStyle = 'rgba(20, 20, 20, 0.4)';
  outputCtx.fillRect(0, 0, width, height);
  
  // Put the composite image on the output canvas
  outputCtx.putImageData(compositeFrame, 0, 0);
}

// Apply image background
function applyImageBackground(segmentation) {
  // Clear the output canvas
  outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  
  // Draw the background image if available
  if (backgroundImage) {
    // Draw the background image, scaled to cover the entire canvas
    const imgRatio = backgroundImage.width / backgroundImage.height;
    const canvasRatio = outputCanvas.width / outputCanvas.height;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgRatio > canvasRatio) {
      // Image is wider than canvas
      drawHeight = outputCanvas.height;
      drawWidth = drawHeight * imgRatio;
      offsetX = (outputCanvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      // Image is taller than canvas
      drawWidth = outputCanvas.width;
      drawHeight = drawWidth / imgRatio;
      offsetX = 0;
      offsetY = (outputCanvas.height - drawHeight) / 2;
    }
    
    outputCtx.drawImage(backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
  } else {
    // If no image is loaded, use a black background
    outputCtx.fillStyle = 'black';
    outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  }
  
  // Draw the foreground (person)
  const imageData = processCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
  const { data: segmentationData } = segmentation;
  
  // Composite the foreground onto the background
  const outputImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
  
  for (let i = 0; i < segmentationData.length; i++) {
    // If this pixel belongs to a person (foreground)
    if (segmentationData[i] === 1) {
      const pixelIndex = i * 4;
      outputImageData.data[pixelIndex] = imageData.data[pixelIndex]; // R
      outputImageData.data[pixelIndex + 1] = imageData.data[pixelIndex + 1]; // G
      outputImageData.data[pixelIndex + 2] = imageData.data[pixelIndex + 2]; // B
      outputImageData.data[pixelIndex + 3] = imageData.data[pixelIndex + 3]; // A
    }
  }
  
  outputCtx.putImageData(outputImageData, 0, 0);
}

// Apply solid color background
function applyColorBackground(segmentation) {
  // Clear the output canvas
  outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  
  // Draw the solid color background
  outputCtx.fillStyle = backgroundColor;
  outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  
  // Draw the foreground (person)
  const imageData = processCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
  const { data: segmentationData } = segmentation;
  
  // Composite the foreground onto the background
  const outputImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
  
  for (let i = 0; i < segmentationData.length; i++) {
    // If this pixel belongs to a person (foreground)
    if (segmentationData[i] === 1) {
      const pixelIndex = i * 4;
      outputImageData.data[pixelIndex] = imageData.data[pixelIndex]; // R
      outputImageData.data[pixelIndex + 1] = imageData.data[pixelIndex + 1]; // G
      outputImageData.data[pixelIndex + 2] = imageData.data[pixelIndex + 2]; // B
      outputImageData.data[pixelIndex + 3] = imageData.data[pixelIndex + 3]; // A
    }
  }
  
  outputCtx.putImageData(outputImageData, 0, 0);
}

// Set the background effect type
function setBackgroundEffect(effectType) {
  currentEffect = effectType;
  console.log(`Background effect changed to: ${effectType}`);
  return currentEffect;
}

// Set a custom background image
function setBackgroundImage(imageUrl) {
  return new Promise((resolve, reject) => {
    if (!imageUrl) {
      backgroundImage = null;
      backgroundImageURL = null;
      resolve(null);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous'; // To handle CORS issues
    
    img.onload = () => {
      backgroundImage = img;
      backgroundImageURL = imageUrl;
      resolve(img);
    };
    
    img.onerror = (error) => {
      console.error('Error loading background image:', error);
      reject(error);
    };
    
    img.src = imageUrl;
  });
}

// Set a custom background color
function setBackgroundColor(color) {
  backgroundColor = color;
  return backgroundColor;
}

// Set blur intensity
function setBlurRadius(radius) {
  blurRadius = radius;
  return blurRadius;
}

// Start the processing loop
function startBackgroundEffects(videoElement, intervalMs = 1000/30) {
  // Process frames at specified interval (default: 30fps)
  const interval = setInterval(() => {
    if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or better
      processFrame(videoElement);
    }
  }, intervalMs);
  
  return {
    stop: () => clearInterval(interval)
  };
}

// Check if the device has adequate performance for background effects
async function checkPerformance() {
  // Very basic performance check
  const startTime = performance.now();
  
  // Try to load the model
  try {
    await loadBodyPixModel();
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    // If model loads in less than 3 seconds, performance is probably adequate
    return {
      capable: loadTime < 3000,
      loadTimeMs: loadTime
    };
  } catch (error) {
    console.error('Performance check failed:', error);
    return {
      capable: false,
      error: error.message
    };
  }
}

// Get current background settings
function getBackgroundSettings() {
  return {
    currentEffect,
    backgroundImageURL,
    backgroundColor,
    blurRadius,
    modelLoaded: !!bodypixModel
  };
}

export {
  loadBodyPixModel,
  initBackgroundEffects,
  processFrame,
  startBackgroundEffects,
  setBackgroundEffect,
  setBackgroundImage,
  setBackgroundColor,
  setBlurRadius,
  checkPerformance,
  getBackgroundSettings
}; 