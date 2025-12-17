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
- **Base Rate**: $750,000 per day
- **Discount**: 3% applied to the total cost
- **Rounding**: The final cost is rounded to the nearest $100,000
- **Formula**: `cost = Round((additional_days × 750,000) × 0.97)`
- **Auto-fill**: Populates the "Cost of extension" field with calculated amount
- **Examples**:
  - 79 days: 79 * 750,000 * 0.97 = 57,472,500 → $57,500,000
  - 55 days: 55 * 750,000 * 0.97 = 40,012,500 → $40,000,000
  - 8 days: 8 * 750,000 * 0.97 = 5,820,000 → $5,800,000

### 5. Form Field Population
- **Input field compatibility**: Works with Torn's tornInputMoney custom input fields
- Handles both visible and hidden input elements correctly
- Triggers necessary events for proper form validation
- Preserves existing form behavior and submission logic

### 6. New Lease Market Autofill
- **Activation**: Runs when on the "Lease" page (`tab=lease`)
- **Tab Switching**: Automatically switches to "Add property to rental market" tab
- **Auto-fill**:
  - **Days**: 100 days
  - **Cost**: Calculated as `100 days × $750,000 = $75,000,000`

### 7. Error Handling
- Graceful handling when:
  - Page structure changes
  - Days remaining can't be parsed
  - Form fields not found
  - Already at or above 100 days
- Console logging for debugging purposes

### 8. Versioning
- Semantic versioning is used
  - **Major** version change will always be indicated by the user.
  - **Minor** change is for new features.
  - **Patch** is for bug fixes and changes in variables.

## Technical Requirements

### DOM Elements to Target
- **Container**: `.offerExtension-opt` (must have `display: block` or not `display: none`)
- **Days remaining text**: Strong tag containing "X days" within the form paragraph
- **Cost input**: `input[data-name="offercost"]` (tornInputMoney field)
- **Days input**: `input[data-name="days"]` (tornInputMoney field)

### Execution Strategy
- **Hash Monitor**: Uses `hashchange` event listener to detect navigation within the single-page application
- **Debouncing**: Delays execution by 100ms after hash changes to prevent multiple executions
- **Retry Logic**: Implements a retry mechanism (up to 10 attempts, 500ms interval) to handle AJAX content loading
- **Initial Load**: Runs immediately on page load (document-end)

### Compatibility
- Works with Torn's jQuery-based tornInputMoney plugin
- Compatible with existing form validation
- No conflicts with other userscripts

## Configuration

### Constants
```javascript
const RATE_PER_DAY = 750000;   // Base rate $750k per day
const DISCOUNT = 0.03;         // 3% discount
const ROUNDING = 100000;       // Round to nearest $100k
const TARGET_DAYS = 100;       // Target total lease length
const RETRY_INTERVAL = 500;    // ms between retries
const MAX_RETRIES = 10;        // Maximum retry attempts
```

