# Torn API Requirements

This document outlines the Torn API endpoints used by the War Hits Tracker and the required API key permissions.

## API Endpoints Used

### 1. `/user/basic` (GET)
- **Purpose**: Retrieve the player's basic profile information (username and player ID)
- **Required Permission**: **Public Access Key**
- **Response Data Used**:
  - `profile.name`: Player username
  - `profile.id`: Player ID number

### 2. `/user/faction` (GET)
- **Purpose**: Retrieve the player's faction information
- **Required Permission**: **Public Access Key**
- **Response Data Used**:
  - `faction.name`: Name of the faction the player belongs to
  - `faction.id`: Faction ID number

### 3. `/faction/wars` (GET)
- **Purpose**: Retrieve details about the faction's current wars and pacts
- **Required Permission**: **Public Access Key**
- **Response Data Used**:
  - `wars.ranked`: Information about the ranked war (single object)
  - `wars.raids`: Information about raid wars (array)
  - `wars.territory`: Information about territory wars (array)
  - For each war: faction names, IDs, scores, and start times

### 4. `/torn/timestamp` (GET)
- **Purpose**: Get current server timestamp to determine if wars are active or upcoming
- **Required Permission**: **Public Access Key**
- **Response Data Used**:
  - `timestamp`: Current server Unix timestamp

### 5. `/user/attacksfull` (GET)
- **Purpose**: Retrieve simplified attack history to count war hits
- **Required Permission**: **Limited Access Key**
- **Query Parameters**:
  - `from`: Unix timestamp to filter attacks from (set to earliest war start)
  - `limit`: Maximum number of attacks to return (set to 1000)
- **Response Data Used**:
  - `attacks`: Collection of attack objects
  - For each attack: `is_ranked_war`, `defender.faction.id`, `respect_gain`

## API Key Permission Levels

### For Basic Functionality (War Status Only)
**Public Access Key** - View your profile, faction, and war status

### For Full Functionality (War Status + Hit Counting)
**Limited Access Key** - Required to access attack history for counting your war hits

### Hit Counting Logic
A war hit is counted when ALL of the following conditions are met:
1. `is_ranked_war` is `true`
2. `defender.faction.id` matches the enemy faction ID
3. `respect_gain` > 0 (successful attack)

## API Base URL

- **API v2 Base URL**: `https://api.torn.com/v2`

## Authentication

The Torn API v2 uses header-based authentication. The API key must be passed in the `Authorization` header with the `ApiKey` prefix:

```
Authorization: ApiKey YOUR_API_KEY_HERE
```

**Example:**
```javascript
fetch('https://api.torn.com/v2/user/basic', {
    headers: {
        'Authorization': 'ApiKey rnavT95qnTCTAbdK'
    }
});
```

**Note:** Do not pass the API key as a query parameter (`?key=...`). The v2 API requires header-based authentication.

## Notes

- All endpoints are called in parallel to minimize loading time
- Error handling is implemented for failed API calls
- CORS is supported by the Torn API for client-side JavaScript calls
