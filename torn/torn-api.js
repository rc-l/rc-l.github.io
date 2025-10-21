/**
 * Torn API Integration
 * Handles all interactions with the Torn API v2
 */

const API_BASE_URL = 'https://api.torn.com/v2';

/**
 * Fetch user basic information
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} User basic data including name and player_id
 */
async function fetchUserBasic(apiKey) {
    const response = await fetch(`${API_BASE_URL}/user/basic`, {
        headers: {
            'Authorization': `ApiKey ${apiKey}`
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('User Basic Error Response:', errorText);
        throw new Error(`Failed to fetch user data: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('User Basic Data:', data);
    return data;
}

/**
 * Fetch user's faction information
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} User faction data including faction_name and faction_id
 */
async function fetchUserFaction(apiKey) {
    const response = await fetch(`${API_BASE_URL}/user/faction`, {
        headers: {
            'Authorization': `ApiKey ${apiKey}`
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('User Faction Error Response:', errorText);
        throw new Error(`Failed to fetch faction data: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('User Faction Data:', data);
    return data;
}

/**
 * Fetch faction wars information
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} Faction wars data including ranked_wars, raid_wars, and territory_wars
 */
async function fetchFactionWars(apiKey) {
    const response = await fetch(`${API_BASE_URL}/faction/wars`, {
        headers: {
            'Authorization': `ApiKey ${apiKey}`
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch wars data: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Fetch current server timestamp
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} Timestamp data
 */
async function fetchTimestamp(apiKey) {
    const response = await fetch(`${API_BASE_URL}/torn/timestamp`, {
        headers: {
            'Authorization': `ApiKey ${apiKey}`
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch timestamp: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Load and display all user data
 * Fetches user basic info, faction info, and war status in parallel
 * @param {string} apiKey - The Torn API key
 */
async function loadUserData(apiKey) {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const userInfo = document.getElementById('userInfo');
    
    try {
        // Show loading
        loadingState.style.display = 'block';
        errorState.style.display = 'none';
        userInfo.style.display = 'none';
        
        // Fetch all data in parallel
        const [userBasic, userFaction, factionWars, timestamp] = await Promise.all([
            fetchUserBasic(apiKey),
            fetchUserFaction(apiKey),
            fetchFactionWars(apiKey),
            fetchTimestamp(apiKey)
        ]);
        
        // Debug: Log the API responses
        console.log('User Basic Response:', userBasic);
        console.log('User Faction Response:', userFaction);
        console.log('Faction Wars Response:', factionWars);
        console.log('Timestamp Response:', timestamp);
        
        // Display user information (data is nested in profile and faction objects)
        document.getElementById('username').textContent = userBasic.profile?.name || 'Unknown';
        document.getElementById('userId').textContent = userBasic.profile?.id || 'N/A';
        document.getElementById('factionName').textContent = userFaction.faction?.name || 'None';
        document.getElementById('factionId').textContent = userFaction.faction?.id || 'N/A';
        
        // Display war information (pass faction info and current timestamp for context)
        displayWarInfo(factionWars, userFaction.faction, timestamp.timestamp);
        
        // Hide loading, show content
        loadingState.style.display = 'none';
        userInfo.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading user data:', error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        document.getElementById('errorMessage').textContent = error.message;
    }
}

/**
 * Display war information on the page
 * Shows active wars broken down by type (ranked, raid, territory)
 * @param {Object} warsData - Wars data from the API
 * @param {Object} userFaction - User's faction information
 * @param {number} currentTimestamp - Current server timestamp
 */
function displayWarInfo(warsData, userFaction, currentTimestamp) {
    const warContent = document.getElementById('warContent');
    
    // Wars data structure: wars.ranked, wars.raids, wars.territory
    const wars = warsData.wars || {};
    // Handle null values - wars.ranked is a single object (not a collection), raids and territory are arrays
    const rankedWar = wars.ranked && typeof wars.ranked === 'object' ? wars.ranked : null;
    const raidWars = Array.isArray(wars.raids) ? wars.raids : [];
    const territoryWars = Array.isArray(wars.territory) ? wars.territory : [];
    
    // Check if ranked war is upcoming or active
    const hasRankedWar = rankedWar !== null && rankedWar.factions && Array.isArray(rankedWar.factions);
    const rankedWarIsUpcoming = hasRankedWar && rankedWar.start > currentTimestamp;
    const rankedWarIsActive = hasRankedWar && rankedWar.start <= currentTimestamp;
    
    const hasRaidWars = raidWars.length > 0;
    const hasTerritoryWars = territoryWars.length > 0;
    
    // Check if there are any active or upcoming wars
    const hasActiveWars = rankedWarIsActive || hasRaidWars || hasTerritoryWars;
    const hasUpcomingWars = rankedWarIsUpcoming;
    
    if (!hasActiveWars && !hasUpcomingWars) {
        warContent.innerHTML = '<p style="color: #2e7d32;">✓ Your faction is not currently at war and has no upcoming wars.</p>';
        return;
    }
    
    let warHtml = '';
    
    // Display active wars message
    if (hasActiveWars) {
        warHtml += '<p style="color: #d32f2f; font-weight: bold;">⚠ Your faction is currently at war!</p>';
    }
    
    // Display upcoming wars message
    if (hasUpcomingWars) {
        warHtml += '<p style="color: #ff9800; font-weight: bold;">📅 Your faction has an upcoming war!</p>';
    }
    
    // Display ranked war (singular - only one ranked war at a time)
    if (hasRankedWar) {
        const isUpcoming = rankedWarIsUpcoming;
        const warStatus = isUpcoming ? 'Upcoming Ranked War' : 'Ranked War';
        const warColor = isUpcoming ? '#ff9800' : '#d32f2f';
        
        warHtml += `<div style="margin-top: 15px;"><strong style="color: ${warColor};">${warStatus}:</strong>`;
        
        // Show start time for upcoming wars
        if (isUpcoming) {
            const startDate = new Date(rankedWar.start * 1000);
            warHtml += `<p style="margin: 5px 0; font-size: 14px;">Starts: ${startDate.toLocaleString()}</p>`;
        }
        
        warHtml += '<ul>';
        
        const factions = rankedWar.factions;
        // factions is an array with 2 elements
        for (const faction of factions) {
            if (!faction) continue;
            
            // Find enemy faction (not the user's faction)
            if (faction.id !== userFaction?.id) {
                warHtml += `<li>vs <strong>${faction.name}</strong> [${faction.id}]`;
                
                // Show scores for active wars
                if (!isUpcoming) {
                    const yourFaction = factions.find(f => f && f.id === userFaction?.id);
                    if (yourFaction && faction.score !== undefined && yourFaction.score !== undefined) {
                        warHtml += ` - Score: ${yourFaction.score} : ${faction.score}`;
                    }
                }
                
                warHtml += '</li>';
            }
        }
        
        warHtml += '</ul></div>';
    }
    
    // Display raid wars
    if (hasRaidWars) {
        warHtml += '<div style="margin-top: 15px;"><strong>Raid Wars:</strong><ul>';
        for (const war of raidWars) {
            // Skip if war or factions is null/undefined
            if (!war || !war.factions) {
                console.warn('Skipping raid war with missing factions data:', war);
                continue;
            }
            
            const factions = war.factions;
            const factionIds = Object.keys(factions);
            
            // Find enemy faction
            for (const factionId of factionIds) {
                const faction = factions[factionId];
                if (!faction) continue;
                
                if (faction.id !== userFaction?.id) {
                    warHtml += `<li>vs <strong>${faction.name}</strong> [${faction.id}]</li>`;
                }
            }
        }
        warHtml += '</ul></div>';
    }
    
    // Display territory wars
    if (hasTerritoryWars) {
        warHtml += '<div style="margin-top: 15px;"><strong>Territory Wars:</strong><ul>';
        for (const war of territoryWars) {
            // Skip if war or factions is null/undefined
            if (!war || !war.factions) {
                console.warn('Skipping territory war with missing factions data:', war);
                continue;
            }
            
            const factions = war.factions;
            const factionIds = Object.keys(factions);
            
            // Find enemy faction
            for (const factionId of factionIds) {
                const faction = factions[factionId];
                if (!faction) continue;
                
                if (faction.id !== userFaction?.id) {
                    warHtml += `<li>vs <strong>${faction.name}</strong> [${faction.id}]`;
                    if (war.territory) {
                        warHtml += ` - Territory: ${war.territory}`;
                    }
                    warHtml += '</li>';
                }
            }
        }
        warHtml += '</ul></div>';
    }
    
    warContent.innerHTML = warHtml;
}
