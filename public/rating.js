// Elements
const stars = document.querySelectorAll('.star');
const ratingLabel = document.getElementById('ratingLabel');
const submitButton = document.getElementById('submitRating');
const thankYouMessage = document.getElementById('thankYouMessage');
const feedbackInput = document.querySelector('.feedback-input');
let currentRating = 0;

// Rating text descriptions
const ratingTexts = [
  '',
  'Poor - I had significant issues',
  'Fair - It worked but with problems',
  'Good - It met my expectations',
  'Very Good - I enjoyed using it',
  'Excellent - It was a great experience!'
];

// Set up star rating system
stars.forEach(star => {
  star.addEventListener('mouseover', () => {
    const value = parseInt(star.dataset.value);
    highlightStars(value);
    ratingLabel.textContent = ratingTexts[value];
  });
  
  star.addEventListener('mouseout', () => {
    highlightStars(currentRating);
    ratingLabel.textContent = ratingTexts[currentRating];
  });
  
  star.addEventListener('click', () => {
    currentRating = parseInt(star.dataset.value);
    highlightStars(currentRating);
    ratingLabel.textContent = ratingTexts[currentRating];
  });
});

// Highlight stars up to a certain value
function highlightStars(value) {
  stars.forEach(star => {
    const starValue = parseInt(star.dataset.value);
    if (starValue <= value) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

// Handle form submission
submitButton.addEventListener('click', () => {
  if (currentRating === 0) {
    alert('Please select a rating before submitting.');
    return;
  }
  
  // In a real app, you would send this data to your server
  const feedback = {
    rating: currentRating,
    comment: feedbackInput.value.trim(),
    timestamp: new Date().toISOString(),
    // You could add user ID or session info here if needed
  };
  
  console.log('Feedback submitted:', feedback);
  
  // Show thank you message
  submitButton.style.display = 'none';
  feedbackInput.style.display = 'none';
  thankYouMessage.style.display = 'block';
  
  // You would normally send this data to your server here
  // For this demo, we're just logging to console
});

// Get meeting duration from URL if present
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const meetingDuration = urlParams.get('duration');
  if (meetingDuration) {
    const minutes = Math.floor(meetingDuration / 60);
    const seconds = meetingDuration % 60;
    document.querySelector('.thank-you').textContent = `Thank you for your ${minutes}m ${seconds}s meeting!`;
  }
});