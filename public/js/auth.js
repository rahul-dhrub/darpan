// Check authentication state
async function checkAuthState() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const user = await response.json();
            updateUIForAuthenticatedUser(user);
        } else if (response.status === 401) {
            // Handle unauthenticated state
            updateUIForUnauthenticatedUser();
        }
    } catch (error) {
        console.error('Error checking auth state:', error);
        showError('There was an error checking your authentication status.');
    }
}

// Update UI based on authentication state
function updateUIForAuthenticatedUser(user) {
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn) {
        loginBtn.textContent = 'Log Out';
        loginBtn.href = '/logout';
    }

    // Add user info to the navbar if needed
    const navLinks = document.querySelector('.nav-links');
    if (!document.querySelector('.user-info')) {
        const userInfo = document.createElement('span');
        userInfo.className = 'user-info';
        userInfo.textContent = `Welcome, ${user.firstName || user.email}`;
        navLinks.insertBefore(userInfo, loginBtn);
    }
}

// Show error message
function showError(message) {
    const existingError = document.querySelector('.auth-error');
    if (existingError) {
        existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'auth-error';
    errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: #f44336; color: white; padding: 15px; border-radius: 4px; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
    errorDiv.textContent = message;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Update UI for unauthenticated state
function updateUIForUnauthenticatedUser() {
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn) {
        loginBtn.textContent = 'Log In';
        loginBtn.href = '#';
    }

    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        userInfo.remove();
    }
}

// Initialize auth handling
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            if (loginBtn.textContent === 'Log In') {
                e.preventDefault();
                window.location.href = '/auth/workos';
            }
        });
    }
    
    checkAuthState();
});
