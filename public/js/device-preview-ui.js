import {
  getAvailableDevices,
  startDevicePreview,
  stopDevicePreview,
  getSelectedDevices,
  handleDeviceChange,
  toggleAudio,
  toggleVideo,
  initBackgroundEffects,
  setBackgroundEffect,
  setBackgroundColor,
  setBackgroundImage,
  setBlurRadius
} from './device-preview.js';


function joinMeeting() {
  const selectedDevices = getSelectedDevices();
  stopDevicePreview();

  sessionStorage.setItem('selectedDevices', JSON.stringify(selectedDevices));

  window.location.href = `/meet?room=${window.roomId}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('camera-select').addEventListener('change', (e) => {
    handleDeviceChange('video', e.target.value);
  });

  document.getElementById('microphone-select').addEventListener('change', (e) => {
    handleDeviceChange('audio', e.target.value);
  });

  document.getElementById('mic-toggle').addEventListener('click', toggleAudio);
  document.getElementById('camera-toggle').addEventListener('click', toggleVideo);

  document.getElementById('cancel-join').addEventListener('click', () => {
    stopDevicePreview();
    window.location.href = '/home';
  });

  document.getElementById('go-back').addEventListener('click', () => {
    stopDevicePreview();
    window.location.href = '/home';
  });

  const mainJoinBtn = document.getElementById('main-join-button');
  mainJoinBtn.addEventListener('click', joinMeeting);

  // Setup background effects UI interactions
  const effectOptions = document.querySelectorAll('.background-effect-option');
  effectOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove active class from all options
      effectOptions.forEach(opt => opt.classList.remove('active'));

      // Add active class to selected option
      option.classList.add('active');

      // Hide all custom controls
      document.querySelectorAll('.custom-background-controls').forEach(
        control => control.classList.remove('active')
      );

      // Get the selected effect
      const effect = option.getAttribute('data-effect');

      // Show relevant custom controls
      if (effect === 'color') {
        document.getElementById('color-bg-controls').classList.add('active');
      } else if (effect === 'image') {
        document.getElementById('image-bg-controls').classList.add('active');

        // Auto-select the first image if available
        const firstPresetBackground = document.querySelector('.preset-background');
        if (firstPresetBackground && window.backgroundEffectsInitialized) {
          const imageUrl = firstPresetBackground.getAttribute('data-image');

          // Only set if not already set
          const preview = document.getElementById('image-preview');
          if (!preview.classList.contains('active')) {
            // Show image preview
            preview.style.backgroundImage = `url(${imageUrl})`;
            preview.classList.add('active');

            // Set as background
            setBackgroundImage(imageUrl);
          }
        }
      }

      // Apply the selected effect
      setBackgroundEffect(effect);
    });
  });

  // Background color picker
  const colorPicker = document.getElementById('background-color-picker');
  colorPicker.addEventListener('input', (e) => {
    setBackgroundColor(e.target.value);

    // Remove active class from all preset colors
    document.querySelectorAll('.preset-color').forEach(color => {
      color.classList.remove('active');
    });
  });

  // Setup preset colors
  const presetColors = document.querySelectorAll('.preset-color');
  presetColors.forEach(colorElement => {
    colorElement.addEventListener('click', () => {
      const color = colorElement.getAttribute('data-color');

      // Update color picker value
      if (colorPicker) {
        colorPicker.value = color;
      }

      // Apply the color
      setBackgroundColor(color);

      // Update active state
      presetColors.forEach(c => c.classList.remove('active'));
      colorElement.classList.add('active');
    });
  });

  // Background image upload
  const uploadBtn = document.getElementById('upload-image-btn');
  const fileInput = document.getElementById('background-image-upload');

  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageURL = URL.createObjectURL(file);

      // Show image preview
      const preview = document.getElementById('image-preview');
      preview.style.backgroundImage = `url(${imageURL})`;
      preview.classList.add('active');

      // Set as background
      setBackgroundImage(imageURL);
    }
  });

  // Preset background images
  const presetBackgrounds = document.querySelectorAll('.preset-background');
  presetBackgrounds.forEach(preset => {
    preset.addEventListener('click', () => {
      const imageUrl = preset.getAttribute('data-image');

      // Show image preview
      const preview = document.getElementById('image-preview');
      preview.style.backgroundImage = `url(${imageUrl})`;
      preview.classList.add('active');

      // Set as background
      setBackgroundImage(imageUrl);
    });
  });

  // Blur intensity slider
  const blurSlider = document.getElementById('blur-intensity');
  const blurValue = document.getElementById('blur-value');

  if (blurSlider && blurValue) {
    blurSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      blurValue.textContent = value;
      setBlurRadius(Number(value));
    });
  }

  try {
    await getAvailableDevices();
    await initBackgroundEffects();
    startDevicePreview();
  } catch (error) {
    console.error("Error initializing device preview:", error);
  }
});

window.addEventListener('beforeunload', () => {
  stopDevicePreview();
}); 