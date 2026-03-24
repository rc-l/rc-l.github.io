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

### 5. `/faction/attacks` (GET)
- **Purpose**: Retrieve detailed outgoing faction attack history for the War Dashboard
- **Required Permission**: **Limited Access Key**
- **Query Parameters**:
  - `filters`: Set to `outgoing`
  - `from`: Unix timestamp to filter attacks from
  - `to`: Unix timestamp to filter attacks up to the war end for finished wars
  - `limit`: Maximum number of attacks to return per page (set to 100)
  - `sort`: Set to `asc` so attacks can be processed in time order
- **Response Data Used**:
  - `attacks`: Collection of attack objects
  - For each attack: `is_ranked_war`, `chain`, `attacker.id`, `attacker.name`, `attacker.faction.id`, `defender.faction.id`, `result`, `respect_gain`

## API Key Permission Levels

### For Basic Functionality (War Status Only)
**Public Access Key** - View your profile, faction, and war status

### For Full Functionality (War Status + War Dashboard Counting)
**Limited Access Key** - Required to access faction attack history for counting ranked-war hits and chain saves

### Hit Counting Logic
A direct ranked-war hit is counted when ALL of the following conditions are met:
1. `is_ranked_war` is `true`
2. `defender.faction.id` matches the enemy faction ID
3. `result` is one of `Attacked`, `Hospitalized`, `Bounty`, or `Assist`

An out-of-faction chain saver also counts when ALL of the following conditions are met:
1. The defender is not in the enemy faction
2. The attacker and defender are not in the same faction
3. The attack is a successful chain-advancing result
4. The attack lands between 4 and 5 minutes after the previous successful chain hit
5. The resulting API `chain` value is greater than 50

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

- War data endpoints are called in parallel where possible, but faction attacks are paged sequentially because the API returns pagination links
- Error handling is implemented for failed API calls
- CORS is supported by the Torn API for client-side JavaScript calls
