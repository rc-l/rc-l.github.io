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
 * Fetch user attacks (simplified version)
 * @param {string} apiKey - The Torn API key
 * @param {number} fromTimestamp - Filter attacks from this timestamp
 * @returns {Promise<Object>} Attacks data
 */
async function fetchUserAttacks(apiKey, fromTimestamp) {
    const url = `${API_BASE_URL}/user/attacksfull?from=${fromTimestamp}&limit=1000&timestamp=${Date.now()}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `ApiKey ${apiKey}`
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch attacks: ${response.status} ${response.statusText}`);
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
        
        // Fetch basic data first
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
        
        // Get earliest war start time for filtering attacks
        const earliestWarStart = getEarliestWarStart(factionWars, timestamp.timestamp);
        
        // Fetch attacks if there are active wars
        let userAttacks = null;
        if (earliestWarStart !== null) {
            userAttacks = await fetchUserAttacks(apiKey, earliestWarStart);
            console.log('User Attacks Response:', userAttacks);
        }
        
        // Display user information (data is nested in profile and faction objects)
        document.getElementById('username').textContent = userBasic.profile?.name || 'Unknown';
        document.getElementById('userId').textContent = userBasic.profile?.id || 'N/A';
        document.getElementById('factionName').textContent = userFaction.faction?.name || 'None';
        document.getElementById('factionId').textContent = userFaction.faction?.id || 'N/A';
        
        // Display war information (pass faction info, timestamp, and attacks for context)
        displayWarInfo(factionWars, userFaction.faction, timestamp.timestamp, userAttacks);
        
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
 * Get the earliest start time from all active wars
 * @param {Object} warsData - Wars data from the API
 * @param {number} currentTimestamp - Current server timestamp
 * @returns {number|null} Earliest war start timestamp, or null if no active wars
 */
function getEarliestWarStart(warsData, currentTimestamp) {
    const wars = warsData.wars || {};
    let earliestStart = null;
    
    // Check ranked war
    const rankedWar = wars.ranked;
    if (rankedWar && rankedWar.start && rankedWar.start <= currentTimestamp) {
        earliestStart = rankedWar.start;
    }
    
    // Check raid wars
    const raidWars = Array.isArray(wars.raids) ? wars.raids : [];
    for (const war of raidWars) {
        if (war && war.start && war.start <= currentTimestamp) {
            if (earliestStart === null || war.start < earliestStart) {
                earliestStart = war.start;
            }
        }
    }
    
    // Check territory wars
    const territoryWars = Array.isArray(wars.territory) ? wars.territory : [];
    for (const war of territoryWars) {
        if (war && war.start && war.start <= currentTimestamp) {
            if (earliestStart === null || war.start < earliestStart) {
                earliestStart = war.start;
            }
        }
    }
    
    return earliestStart;
}

/**
 * Count war hits for a specific enemy faction
 * @param {Object} attacksData - Attacks data from the API
 * @param {number} enemyFactionId - The enemy faction ID
 * @returns {number} Number of successful war hits
 */
function countWarHits(attacksData, enemyFactionId) {
    if (!attacksData || !attacksData.attacks) {
        return 0;
    }
    
    let hitCount = 0;
    const attacks = Array.isArray(attacksData.attacks) ? attacksData.attacks : Object.values(attacksData.attacks);
    
    console.log('Counting war hits for enemy faction:', enemyFactionId);
    console.log('Total attacks to check:', attacks.length);
    
    for (const attack of attacks) {
        // Log each attack for debugging
        console.log('Checking attack:', {
            id: attack.id,
            defender_faction: attack.defender?.faction_id,
            respect_gain: attack.respect_gain,
            result: attack.result
        });
        
        // Check if defender is from the enemy faction
        if (attack.defender?.faction_id !== enemyFactionId) {
            console.log('  -> Skipped: Wrong faction');
            continue;
        }
        
        // Check if attack was successful (respect gained)
        // Note: attacksfull doesn't include is_ranked_war flag, but if we filtered by war start time
        // and the defender is in the enemy faction, it should be a war hit
        if (attack.respect_gain && attack.respect_gain > 0) {
            console.log('  -> COUNTED as war hit!');
            hitCount++;
        } else {
            console.log('  -> Skipped: No respect gained');
        }
    }
    
    console.log('Total war hits counted:', hitCount);
    return hitCount;
}

/**
 * Display war information on the page
 * Shows active wars broken down by type (ranked, raid, territory)
 * @param {Object} warsData - Wars data from the API
 * @param {Object} userFaction - User's faction information
 * @param {number} currentTimestamp - Current server timestamp
 * @param {Object} attacksData - User attacks data (optional)
 */
function displayWarInfo(warsData, userFaction, currentTimestamp, attacksData) {
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
                    
                    // Show hit counter for active wars
                    if (attacksData) {
                        const hitCount = countWarHits(attacksData, faction.id);
                        warHtml += `<br><span style="color: #2196F3; font-weight: bold;">Your Hits: ${hitCount}</span>`;
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
