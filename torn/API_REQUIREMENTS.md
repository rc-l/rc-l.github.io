# Torn API Requirements

This document outlines the Torn API endpoints used by the War Hits Tracker and the required API key permissions.

## API Endpoints Used

### 1. `/user/basic` (GET)
- **Purpose**: Retrieve the player's basic profile information (username and player ID)
- **Required Permission**: **Public Access Key**
- **Response Data Used**:
  - `name`: Player username
  - `player_id`: Player ID number

### 2. `/user/faction` (GET)
- **Purpose**: Retrieve the player's faction information
- **Required Permission**: **Public Access Key**
- **Response Data Used**:
  - `faction_name`: Name of the faction the player belongs to
  - `faction_id`: Faction ID number

### 3. `/faction/wars` (GET)
- **Purpose**: Retrieve details about the faction's current wars and pacts
- **Required Permission**: **Public Access Key**
- **Response Data Used**:
  - `ranked_wars`: Information about ranked wars
  - `raid_wars`: Information about raid wars
  - `territory_wars`: Information about territory wars
  - For each war type: faction names, IDs, and scores

## Minimum API Key Permission Required

**Public Access Key**

All three endpoints require only a **Public Access Key**, which is the most basic level of API access in Torn. This ensures maximum security as users don't need to provide keys with elevated permissions.

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
