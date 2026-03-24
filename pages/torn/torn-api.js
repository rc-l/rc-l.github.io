/**
 * Torn API Integration
 * Handles all interactions with the Torn API v2
 */

const API_BASE_URL = 'https://api.torn.com/v2';
const TORN_API_RATE_LIMIT_ERROR_CODE = 5;
const TORN_API_PERMISSION_ERROR_CODE = 16;
const TORN_API_DEFAULT_RETRY_ATTEMPTS = 2;
const TORN_API_BACKOFF_BASE_MS = 5000;
const TORN_API_BACKOFF_MAX_MS = 65000;
const TORN_API_RATE_LIMIT_COOLDOWN_MS = 60000;
const TORN_API_DEBUG_STORAGE_KEY = 'torn_api_debug_logging';

let tornApiRequestQueue = Promise.resolve();
let tornApiBlockedUntil = 0;
const tornApiInFlightRequests = new Map();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildTornApiUrl(pathOrUrl, queryParams = null) {
    const url = pathOrUrl.startsWith('http')
        ? new URL(pathOrUrl)
        : new URL(pathOrUrl, `${API_BASE_URL}/`);

    if (queryParams) {
        for (const [key, value] of Object.entries(queryParams)) {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.set(key, value);
            }
        }
    }

    return url.toString();
}

function createTornApiError(message, details = {}) {
    const error = new Error(message);
    Object.assign(error, details);
    return error;
}

function getRetryDelayMs(attemptIndex) {
    const exponentialDelay = TORN_API_BACKOFF_BASE_MS * Math.pow(2, attemptIndex);
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(exponentialDelay + jitter, TORN_API_BACKOFF_MAX_MS);
}

function emitTornApiEvent(name, detail) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }
}

function isTornApiDebugEnabled() {
    if (typeof window === 'undefined') {
        return false;
    }

    if (window.__TORN_API_DEBUG === true) {
        return true;
    }

    try {
        return window.localStorage.getItem(TORN_API_DEBUG_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function logTornApiDebug(message, detail = {}) {
    if (!isTornApiDebugEnabled()) {
        return;
    }
    console.debug(`[Torn API] ${message}`, detail);
}

function setTornApiDebugLogging(enabled) {
    if (typeof window === 'undefined') {
        return;
    }

    window.__TORN_API_DEBUG = Boolean(enabled);

    try {
        if (enabled) {
            window.localStorage.setItem(TORN_API_DEBUG_STORAGE_KEY, '1');
        } else {
            window.localStorage.removeItem(TORN_API_DEBUG_STORAGE_KEY);
        }
    } catch {
        // Ignore localStorage failures and keep the in-memory toggle.
    }

    console.info(`[Torn API] Debug logging ${enabled ? 'enabled' : 'disabled'}`);
}

if (typeof window !== 'undefined') {
    window.setTornApiDebugLogging = setTornApiDebugLogging;
}

function reportTornApiRateLimit(detail) {
    console.warn('[Torn API] Rate limit hit', detail);
    emitTornApiEvent('torn-api-rate-limit', detail);
}

function clearTornApiRateLimit(detail = {}) {
    emitTornApiEvent('torn-api-rate-limit-cleared', detail);
}

function getRetryAfterDelayMs(response) {
    const retryAfterHeader = response.headers.get('Retry-After');
    if (!retryAfterHeader) {
        return null;
    }

    const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(retryAfterSeconds)) {
        return Math.max(retryAfterSeconds * 1000, 0);
    }

    const retryAfterTime = Date.parse(retryAfterHeader);
    if (Number.isFinite(retryAfterTime)) {
        return Math.max(retryAfterTime - Date.now(), 0);
    }

    return null;
}

async function waitForTornApiAvailability() {
    const waitUntil = tornApiBlockedUntil;
    const delay = waitUntil - Date.now();
    if (delay > 0) {
        await sleep(delay);
    }
}

function queueTornApiOperation(operation) {
    const queuedOperation = tornApiRequestQueue.then(operation, operation);
    tornApiRequestQueue = queuedOperation.catch(() => {});
    return queuedOperation;
}

function buildTornApiRequestKey(apiKey, url, fetchOptions = {}) {
    return JSON.stringify({
        apiKey,
        url,
        method: fetchOptions.method || 'GET',
        body: fetchOptions.body || null
    });
}

async function parseTornApiResponse(response) {
    const responseText = await response.text();
    let data = null;

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            data = null;
        }
    }

    return {
        data,
        responseText
    };
}

async function tornApiRequest(apiKey, pathOrUrl, options = {}) {
    const {
        queryParams = null,
        retryAttempts = TORN_API_DEFAULT_RETRY_ATTEMPTS,
        fetchOptions = {}
    } = options;

    const url = buildTornApiUrl(pathOrUrl, queryParams);
    const requestKey = buildTornApiRequestKey(apiKey, url, fetchOptions);
    const existingRequest = tornApiInFlightRequests.get(requestKey);

    if (existingRequest) {
        logTornApiDebug('Reusing in-flight request', { url, requestKey });
        return existingRequest;
    }

    const requestPromise = queueTornApiOperation(async () => {
        logTornApiDebug('Queueing request', { url, requestKey, retryAttempts });

        for (let attempt = 0; attempt <= retryAttempts; attempt++) {
            await waitForTornApiAvailability();
            logTornApiDebug('Request start', {
                url,
                requestKey,
                attempt: attempt + 1,
                retryAttempts,
                blockedUntil: tornApiBlockedUntil
            });

            const response = await fetch(url, {
                ...fetchOptions,
                headers: {
                    'Authorization': `ApiKey ${apiKey}`,
                    ...(fetchOptions.headers || {})
                }
            });

            const { data, responseText } = await parseTornApiResponse(response);
            const apiError = data?.error || null;
            const rateLimitHit = response.status === 429 || apiError?.code === TORN_API_RATE_LIMIT_ERROR_CODE;

            if (rateLimitHit) {
                const retryAfterDelayMs = getRetryAfterDelayMs(response);
                const retryDelayMs = Math.max(
                    retryAfterDelayMs || 0,
                    getRetryDelayMs(attempt),
                    TORN_API_RATE_LIMIT_COOLDOWN_MS
                );
                tornApiBlockedUntil = Math.max(tornApiBlockedUntil, Date.now() + retryDelayMs);
                reportTornApiRateLimit({
                    url,
                    attempt: attempt + 1,
                    retryAttempts,
                    retryDelayMs,
                    retryAt: tornApiBlockedUntil,
                    status: response.status,
                    code: apiError?.code || null,
                    message: apiError?.error || response.statusText || 'Too many requests'
                });

                if (attempt >= retryAttempts) {
                    throw createTornApiError('Torn API rate limit is still active. Please wait and try again.', {
                        status: response.status,
                        responseText,
                        data,
                        isRateLimitError: true,
                        retryAt: tornApiBlockedUntil
                    });
                }

                await sleep(Math.max(tornApiBlockedUntil - Date.now(), 0));
                continue;
            }

            if (!response.ok) {
                logTornApiDebug('Request failed', {
                    url,
                    requestKey,
                    attempt: attempt + 1,
                    status: response.status,
                    apiError
                });
                const message = apiError
                    ? `API error ${apiError.code}: ${apiError.error}`
                    : `Failed to fetch data: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ''}`;
                throw createTornApiError(message, {
                    status: response.status,
                    responseText,
                    data,
                    isPermissionError: apiError?.code === TORN_API_PERMISSION_ERROR_CODE,
                    isRateLimitError: rateLimitHit
                });
            }

            if (apiError) {
                logTornApiDebug('Request returned API error', {
                    url,
                    requestKey,
                    attempt: attempt + 1,
                    apiError
                });
                throw createTornApiError(`API error ${apiError.code}: ${apiError.error}`, {
                    code: apiError.code,
                    data,
                    isPermissionError: apiError.code === TORN_API_PERMISSION_ERROR_CODE,
                    isRateLimitError: apiError.code === TORN_API_RATE_LIMIT_ERROR_CODE
                });
            }

            const wasRateLimited = tornApiBlockedUntil > 0;
            tornApiBlockedUntil = 0;
            if (wasRateLimited) {
                console.info('[Torn API] Rate limit cleared', { url });
                clearTornApiRateLimit({ url });
            }
            logTornApiDebug('Request succeeded', {
                url,
                requestKey,
                attempt: attempt + 1
            });
            return data || {};
        }
        throw createTornApiError('Failed to fetch data after retrying rate-limited request.', {
            isRateLimitError: true
        });
    }).finally(() => {
        tornApiInFlightRequests.delete(requestKey);
        logTornApiDebug('Request released', { url, requestKey });
    });

    tornApiInFlightRequests.set(requestKey, requestPromise);
    return requestPromise;
}

/**
 * Validate API key permissions
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} Validation result with {valid: boolean, missing: array, accessLevel: string}
 */
async function validateApiKey(apiKey) {
    try {
        const data = await tornApiRequest(apiKey, 'key/info');
        console.log('Key Info Data:', data);
        
        // Required permissions for the war hits tracker
        // Format: category.selection (e.g., 'user.basic', 'faction.rankedwars')
        const requiredPermissions = {
            'torn': ['timestamp'],
            'user': ['basic', 'faction', 'attacksfull'],
            'faction': ['rankedwars']
        };
        
        // Get selections from API response
        const selections = data.info?.selections || {};
        const accessLevel = data.info?.access?.level || 0;
        const accessType = data.info?.access?.type || 'Unknown';
        
        // Collect all available permissions in "category.selection" format
        const availablePermissions = [];
        for (const [category, selectionArray] of Object.entries(selections)) {
            if (Array.isArray(selectionArray)) {
                for (const selection of selectionArray) {
                    availablePermissions.push(`${category}.${selection}`);
                }
            }
        }
        
        return {
            valid: true,
            accessLevel: accessType, // 'Public', 'Minimal', 'Limited', 'Full', 'Custom'
            permissions: availablePermissions
        };
    } catch (error) {
        console.error('API Key validation error:', error);
        return { valid: false, error: error.message };
    }
}

/**
 * Fetch user basic information
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} User basic data including name and player_id
 */
async function fetchUserBasic(apiKey) {
    const data = await tornApiRequest(apiKey, 'user/basic');
    console.log('User Basic Data:', data);
    return data;
}

/**
 * Fetch basic information for a specific user by ID
 * @param {string} apiKey - The Torn API key
 * @param {number} userId - The user ID to look up
 * @returns {Promise<Object>} User basic data
 */
async function fetchUserBasicById(apiKey, userId) {
    return await tornApiRequest(apiKey, `user/${userId}/basic`);
}

/**
 * Fetch user's faction information
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} User faction data including faction_name and faction_id
 */
async function fetchUserFaction(apiKey) {
    const data = await tornApiRequest(apiKey, 'user/faction');
    console.log('User Faction Data:', data);
    return data;
}

/**
 * Fetch faction wars information
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} Faction wars data including ranked_wars, raid_wars, and territory_wars
 */
async function fetchFactionWars(apiKey) {
    return await tornApiRequest(apiKey, 'faction/wars');
}

/**
 * Fetch current server timestamp
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} Timestamp data
 */
async function fetchTimestamp(apiKey) {
    return await tornApiRequest(apiKey, 'torn/timestamp');
}

/**
 * Fetch user attacks (simplified version)
 * @param {string} apiKey - The Torn API key
 * @param {number} fromTimestamp - Filter attacks from this timestamp
 * @returns {Promise<Object>} Attacks data
 */
async function fetchUserAttacks(apiKey, fromTimestamp) {
    return await tornApiRequest(apiKey, 'user/attacksfull', {
        queryParams: {
            from: fromTimestamp,
            limit: 1000,
            timestamp: Date.now()
        }
    });
}

/**
 * Fetch user logs
 * @param {string} apiKey - The Torn API key
 * @param {Object} options - Query options (from, to, limit, log, cat)
 * @returns {Promise<Object>} The logs data
 */
async function fetchUserLogs(apiKey, options = {}) {
    return await tornApiRequest(apiKey, 'user/log', {
        queryParams: {
            from: options.from,
            to: options.to,
            limit: options.limit,
            log: options.log,
            cat: options.cat
        }
    });
}

/**
 * Fetch faction basic information (id, name, etc.)
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} Faction basic data
 */
async function fetchFactionBasic(apiKey) {
    const data = await tornApiRequest(apiKey, 'faction/basic');
    console.log('Faction Basic Data:', data);
    return data;
}

/**
 * Fetch faction ranked wars history
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} Ranked wars data
 */
async function fetchFactionRankedWars(apiKey) {
    const data = await tornApiRequest(apiKey, 'faction/rankedwars');
    console.log('Faction Ranked Wars Data:', data);
    return data;
}

/**
 * Fetch current faction members
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} Faction members data
 */
async function fetchFactionMembers(apiKey) {
    const data = await tornApiRequest(apiKey, 'faction/members');
    console.log('Faction Members Data:', data);
    return data;
}

/**
 * Fetch all outgoing faction attacks with pagination using the simplified endpoint
 * @param {string} apiKey - The Torn API key
 * @param {number} from - Only return attacks after this timestamp
 * @param {number|null} to - Only return attacks up to this timestamp
 * @returns {Promise<Object[]>} Array of all attack objects
 */
async function fetchFactionAttacks(apiKey, from, to = null) {
    const allAttacks = [];
    const seenPageUrls = new Set();
    const seenAttackKeys = new Set();

    function buildPageUrl(fromTimestamp) {
        return buildTornApiUrl('faction/attacksfull', {
            filters: 'outgoing',
            sort: 'asc',
            limit: 1000,
            from: fromTimestamp,
            to: Number.isFinite(to) ? to : null
        });
    }

    function getAttackTimestamp(attack) {
        return Number(
            attack?.started
            ?? attack?.timestamp_started
            ?? attack?.timestamp
            ?? attack?.ended
            ?? 0
        );
    }

    function getAttackKey(attack) {
        if (attack?.id != null) return `id:${attack.id}`;
        return [
            getAttackTimestamp(attack),
            attack?.attacker?.id ?? 0,
            attack?.defender?.id ?? 0,
            attack?.result ?? '',
            attack?.respect_gain ?? ''
        ].join(':');
    }

    let url = buildPageUrl(from);

    while (url) {
        if (seenPageUrls.has(url)) {
            console.warn('[Torn API] Detected repeated faction attacks page URL, stopping pagination.', { url });
            break;
        }
        seenPageUrls.add(url);

        const data = await tornApiRequest(apiKey, url);
        const page = Array.isArray(data.attacks) ? data.attacks : Object.values(data.attacks || {});
        let latestTimestampOnPage = Number(from) || 0;

        for (const attack of page) {
            const attackKey = getAttackKey(attack);
            if (seenAttackKeys.has(attackKey)) continue;
            seenAttackKeys.add(attackKey);
            allAttacks.push(attack);

            const attackTimestamp = getAttackTimestamp(attack);
            if (Number.isFinite(attackTimestamp) && attackTimestamp > latestTimestampOnPage) {
                latestTimestampOnPage = attackTimestamp;
            }
        }

        const nextUrl = data._metadata?.links?.next || null;
        if (!nextUrl) {
            url = null;
            continue;
        }

        if (nextUrl === url || seenPageUrls.has(nextUrl)) {
            const currentUrl = new URL(url);
            const currentFrom = Number(currentUrl.searchParams.get('from'));
            const advancedFrom = latestTimestampOnPage + 1;

            if (!Number.isFinite(currentFrom) || !Number.isFinite(advancedFrom) || advancedFrom <= currentFrom) {
                console.warn('[Torn API] Detected non-advancing faction attacks pagination, stopping pagination.', {
                    url: nextUrl,
                    currentFrom,
                    latestTimestampOnPage,
                    pageSize: page.length
                });
                url = null;
                continue;
            }

            console.warn('[Torn API] Detected repeated faction attacks page URL, advancing pagination cursor manually.', {
                url: nextUrl,
                currentFrom,
                advancedFrom,
                pageSize: page.length
            });
            url = buildPageUrl(advancedFrom);
            continue;
        }

        url = nextUrl;
    }

    return allAttacks;
}

/**
 * Fetch log categories
 * @param {string} apiKey - The Torn API key
 * @returns {Promise<Object>} The log categories
 */
async function fetchLogCategories(apiKey) {
    return await tornApiRequest(apiKey, 'torn/logcategories');
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
                        warHtml += ` - Score: ${faction.score} : ${yourFaction.score}`;
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
