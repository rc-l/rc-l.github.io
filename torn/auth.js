/**
 * Shared Authentication Module
 * Handles login/logout state across all pages
 */

// Local storage management functions
function saveApiKey(apiKey) {
    try {
        localStorage.setItem('torn_api_key', apiKey);
        return true;
    } catch (e) {
        console.error('Failed to save API key:', e);
        return false;
    }
}

function getApiKey() {
    try {
        return localStorage.getItem('torn_api_key');
    } catch (e) {
        console.error('Failed to retrieve API key:', e);
        return null;
    }
}

function removeApiKey() {
    try {
        localStorage.removeItem('torn_api_key');
        localStorage.removeItem('torn_username');
        return true;
    } catch (e) {
        console.error('Failed to remove API key:', e);
        return false;
    }
}

function saveUsername(username) {
    try {
        localStorage.setItem('torn_username', username);
        return true;
    } catch (e) {
        console.error('Failed to save username:', e);
        return false;
    }
}

function getUsername() {
    try {
        return localStorage.getItem('torn_username');
    } catch (e) {
        console.error('Failed to retrieve username:', e);
        return null;
    }
}

// Initialize authentication header on page load
async function initAuthHeader() {
    const authContainer = document.getElementById('authContainer');
    if (!authContainer) {
        console.error('Auth container not found');
        return;
    }
    
    const apiKey = getApiKey();
    
    if (apiKey && apiKey.trim() !== '') {
        // User is logged in - try to get username
        let username = getUsername();
        
        // If no cached username, fetch it
        if (!username) {
            try {
                const response = await fetch(`https://api.torn.com/v2/user/basic`, {
                    headers: { 'Authorization': `ApiKey ${apiKey}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    username = data.profile?.name || 'User';
                    saveUsername(username);
                } else {
                    username = 'User';
                }
            } catch (error) {
                console.error('Failed to fetch username:', error);
                username = 'User';
            }
        }
        
        showLoggedInState(username);
    } else {
        // User is not logged in
        showLoggedOutState();
    }
}

// Show logged-out state (login form)
function showLoggedOutState() {
    const authContainer = document.getElementById('authContainer');
    authContainer.innerHTML = `
        <input type="text" id="headerApiKey" placeholder="Enter API Key" style="padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; width: 150px;" />
        <button onclick="headerLogin()" style="margin: 0 0 0 8px; padding: 6px 16px; font-size: 13px;">Login</button>
        <p id="headerError" style="display: none; color: #d32f2f; font-size: 12px; margin: 5px 0 0 0; position: absolute; right: 0;"></p>
    `;
    
    // Add Enter key handler
    const input = document.getElementById('headerApiKey');
    if (input) {
        input.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                headerLogin();
            }
        });
    }
}

// Show logged-in state (username + logout button)
function showLoggedInState(username) {
    const authContainer = document.getElementById('authContainer');
    authContainer.innerHTML = `
        <span style="color: #333; font-size: 14px; margin-right: 10px;">👤 ${username}</span>
        <button class="logout-button" onclick="headerLogout()" style="margin: 0;">Logout</button>
    `;
}

// Handle login from header
async function headerLogin() {
    const input = document.getElementById('headerApiKey');
    const errorMsg = document.getElementById('headerError');
    const apiKey = input.value.trim();
    
    if (apiKey === '') {
        errorMsg.textContent = 'Please enter an API key';
        errorMsg.style.display = 'block';
        return;
    }
    
    errorMsg.style.display = 'none';
    
    // Save API key
    if (saveApiKey(apiKey)) {
        // Try to fetch username (optional - don't block on failure)
        try {
            const response = await fetch(`https://api.torn.com/v2/user/basic`, {
                headers: { 'Authorization': `ApiKey ${apiKey}` }
            });
            if (response.ok) {
                const data = await response.json();
                const username = data.profile?.name || 'User';
                saveUsername(username);
                showLoggedInState(username);
            } else {
                // API call failed, but we still log in
                showLoggedInState('User');
            }
        } catch (error) {
            console.error('Failed to fetch username:', error);
            showLoggedInState('User');
        }
        
        // Reload page if on warhits to trigger validation and data load
        if (window.location.pathname.includes('warhits.html')) {
            window.location.reload();
        }
    } else {
        errorMsg.textContent = 'Failed to save API key';
        errorMsg.style.display = 'block';
    }
}

// Handle logout from header
function headerLogout() {
    if (confirm('Are you sure you want to logout?')) {
        removeApiKey();
        window.location.reload();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initAuthHeader);
