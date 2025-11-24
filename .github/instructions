The goal of my project is to allow players of the game torn.com to keep track of the number of hits they made in the active war. This is done through #file:warhits.html.

Torn API v2 documentation can be found in #openapi.json

# Documentation
- Update #API_REQUIREMENTS.md to document which API endpoints are used and what permissions are needed
- Keep the required permissions at a minimum
- Keep #API_REQUIREMENTS.md up to date when adding or modifying API calls
- Keep this instructions file up to date when requirements change

# Authentication & Login
- Users are identified with their API key which will be used to call the torn.com APIs
- API keys are stored in localStorage for persistence across sessions
- Username is cached in localStorage to avoid unnecessary API calls on every page load
- Login UI is displayed in the header on ALL pages (index, warhits, faq, and any future pages)
- When NOT logged in:
  - Show compact inline input field + "Login" button in the top-right header
- When logged in:
  - Show username and "Logout" button in the top-right header
  - Username should be fetched from localStorage if available (to avoid unnecessary API calls)
  - If username not cached, fetch it once from /user/basic endpoint and cache it
- Login process:
  - User enters API key in header input field
  - Validate API key permissions (only on warhits.html)
  - Fetch and cache username from /user/basic endpoint
  - Save API key to localStorage
  - Stay on current page and update header to show logged-in state
- Logout process:
  - Clear API key and username from localStorage
  - Reload current page
- Authentication state must persist across all pages in torn/

# Code quality
- Keep the code DRY.
- Handle potential null value without running into errors.
- Centralize authentication logic in a shared JavaScript file (auth.js).