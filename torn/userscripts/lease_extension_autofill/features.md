# Torn Lease Extension Autofill - Features

## Overview
A userscript that automatically fills the 'cost of extension' and 'additional days' fields on the Torn.com property lease extension page to help property owners quickly offer lease extensions to tenants.

## Core Features

### 1. Page Detection & Activation
- **URL-based activation**: Only runs when on the extension offer page
  - URL pattern: `https://www.torn.com/properties.php#/p=options&ID=<propertyID>&tab=offerExtension`
  - Script remains dormant on other property pages (main, facilities, staff, etc.)
- **Form detection**: Waits for the extension form to be present in the DOM
- **Stability**: No interference with other property page functionality

### 2. Days Remaining Detection
- **Parses current lease status** from the page text
- Extracts "X days remaining" value from the lease information paragraph
- Example: "There are **21 days** remaining" → extracts 21

### 3. Additional Days Calculation
- **Target**: Always extend to exactly 100 days total
- **Formula**: `additional_days = 100 - days_remaining`
- **Auto-fill**: Populates the "Additional days" field with calculated value
- **Examples**:
  - 21 days remaining → Add 79 days
  - 45 days remaining → Add 55 days
  - 92 days remaining → Add 8 days

### 4. Cost of Extension Calculation
- **Rate**: $720,000 per day (configurable constant)
- **Formula**: `cost = additional_days × 720,000`
- **Auto-fill**: Populates the "Cost of extension" field with calculated amount
- **Examples**:
  - 79 days → $56,880,000
  - 55 days → $39,600,000
  - 8 days → $5,760,000

### 5. Form Field Population
- **Input field compatibility**: Works with Torn's tornInputMoney custom input fields
- Handles both visible and hidden input elements correctly
- Triggers necessary events for proper form validation
- Preserves existing form behavior and submission logic

### 6. Error Handling
- Graceful handling when:
  - Page structure changes
  - Days remaining can't be parsed
  - Form fields not found
  - Already at or above 100 days
- Console logging for debugging purposes

## Technical Requirements

### DOM Elements to Target
- **Container**: `.offerExtension-opt` (must have `display: block` or not `display: none`)
- **Days remaining text**: Strong tag containing "X days" within the form paragraph
- **Cost input**: `input[data-name="offercost"]` (tornInputMoney field)
- **Days input**: `input[data-name="days"]` (tornInputMoney field)

### Timing Considerations
- Script runs at document-end
- Observes DOM for dynamic content loading (properties page uses React/AJAX)
- Implements retry logic if form not immediately available
- Debounce to avoid multiple executions on hash changes

### Compatibility
- Works with Torn's jQuery-based tornInputMoney plugin
- Compatible with existing form validation
- No conflicts with other userscripts

## Implementation Considerations

### Approach Options

#### Option 1: Simple Hash Monitor (Recommended)
**Pros:**
- Straightforward implementation
- Low overhead
- Easy to debug
- Works with Torn's hash-based navigation

**Cons:**
- May need retry logic for AJAX-loaded content

**Implementation:**
```javascript
// Monitor hash changes
window.addEventListener('hashchange', checkAndFill);
// Initial check
checkAndFill();
```

#### Option 2: MutationObserver
**Pros:**
- Catches all DOM changes
- No polling needed
- Very reliable

**Cons:**
- More complex
- Higher overhead
- May trigger multiple times unnecessarily

**Implementation:**
```javascript
const observer = new MutationObserver(() => {
    if (isOnExtensionTab()) {
        checkAndFill();
    }
});
observer.observe(document.body, { childList: true, subtree: true });
```

#### Option 3: Hybrid Approach
**Pros:**
- Best reliability
- Handles both hash navigation and dynamic content

**Cons:**
- Most complex
- Slight code duplication

**Implementation:**
```javascript
// Hash changes for navigation
window.addEventListener('hashchange', scheduleCheck);
// Observer for AJAX content
observer.observe(contentArea, { childList: true, subtree: true });
```

### Recommendation
**Use Option 1 (Simple Hash Monitor)** with:
- Hash change listener for navigation
- Small retry mechanism (500ms intervals, max 10 attempts)
- Debouncing to prevent duplicate executions
- Check for form visibility before filling

This provides the best balance of simplicity, reliability, and maintainability.

## Configuration

### Constants
```javascript
const RATE_PER_DAY = 720000;  // $720k per day
const TARGET_DAYS = 100;       // Target total lease length
const RETRY_INTERVAL = 500;    // ms between retries
const MAX_RETRIES = 10;        // Maximum retry attempts
```

