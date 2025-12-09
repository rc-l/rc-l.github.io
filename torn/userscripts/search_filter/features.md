# Torn Advanced Search Filter - Features

## Overview
A userscript for the TornPDA app that enhances the Torn.com advanced search page with filtering capabilities and quick attack buttons.

## Core Features

### 1. Filter Bar
- **Non-sticky black menu bar** at the top of search results (scrolls with page)
- **Responsive layout** that adapts to screen size
- Title "Advanced Filter" on dedicated line
- Toggles wrap to multiple rows on smaller screens
- Persists across page navigation (no duplicates)

### 2. User Filters
Toggle-based filters to hide users from search results:

#### Federal Jail Filter
- Hides users currently in federal jail
- Detects "Federal" text and icon16 elements
- Checks title attributes for federal jail status

#### Traveling Filter
- Hides users who are traveling or abroad
- Detects "Traveling", "traveling", "Abroad", "abroad" text
- Checks title attributes for travel status

#### RIP Filter
- Hides deceased users
- Detects "Resting in peace" status
- Checks for icon77 and related title attributes

### 3. Attack Buttons & Display Modes
- **Quick attack button** in dedicated column when enabled
- Red "Attack" buttons for visibility
- Direct navigation to attack page with correct user ID
- Touch-responsive for mobile devices
- **Toggle between two display modes:**
  - **Attack Buttons ON**: Shows custom simplified result list with faction, username, and attack button
  - **Attack Buttons OFF**: Shows original Torn results with filtering applied

### 4. Custom Result List
- **Simplified table layout** with three columns: Faction, Username, Action
- Clean, dark theme matching Torn's aesthetic
- Proper placement between pagination elements
- Alternating row colors for readability
- Hover effects on rows and buttons
- Eliminates layout issues from inline attack buttons

### 4. Custom Result List
- **Simplified table layout** with three columns: Faction, Username, Action
- Clean, dark theme matching Torn's aesthetic
- Proper placement between pagination elements
- Alternating row colors for readability
- Hover effects on rows and buttons
- Eliminates layout issues from inline attack buttons

### 5. State Persistence
- All toggle states saved to localStorage
- Settings persist across page visits and browser sessions
- Default state: filters OFF, attack buttons ON
- Key: `tornAdvancedFilters`

## Technical Features

### MutationObserver for Dynamic Content
- Watches for search result changes (initial load, pagination)
- 200ms debounce prevents excessive rebuilds
- Automatically detects when new results are loaded
- Handles Torn's dynamic content loading seamlessly

### Smart Content Detection
- Fallback polling mechanism for initial content detection
- Handles dynamically loaded search results
- 500ms initial timeout before building custom list
- Prevents premature script execution

### Mobile Optimization
- Touch event handling with `touchstart` listeners
- Passive: false for reliable touch interaction
- preventDefault and stopPropagation for clean navigation
- User-select: none and tap-highlight-color for better UX

### Defensive Programming
- Checks if filter bar already exists before creating
- Prevents duplicate bars on pagination
- Console logging for debugging
- Error handling for missing elements

## Version History

- **v0.8**: Initial release with Federal Jail and Traveling filters
- **v0.9**: Added attack buttons with toggle
- **v0.10**: Fixed state initialization and localStorage merging
- **v1.1**: Added RIP filter for deceased users
- **v1.1.2**: Responsive layout with wrapping toggles
- **v1.1.3**: Fixed duplicate filter bars on pagination
- **v2.0.0**: Major rewrite - custom result list with MutationObserver for timing issues
- **v2.1.0**: Cosmetic fixes (non-sticky filter bar, proper placement) and dual display mode (custom list vs filtered original)

## Compatibility
- Designed for TornPDA inbuilt browser
- Works on Torn.com advanced search page
- URL pattern: `https://www.torn.com/page.php?sid=UserList*`
- Execution: document-end
- No external dependencies (vanilla JavaScript)
