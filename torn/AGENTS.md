The goal of my project is to allow players of the game torn.com to keep track of the number of hits they made in the active war. This is done through #file:warhits.html.
Users are identified with their API key which will be used to call the torn.com apis. On the warhits page a field is needed for users to enter their api key. Once this is done they need to be redirected to warhits.html with the api key as a url parameter. This will enable the user to bookmark the page with their api key

Torn API v2 documentation can be found in #openapi.json

Update #API_REQUIREMENS.md to document which API endpoints are used and what permissions are needed
Keep the required permissions at a minimum

# Code quality
- Keep the code DRY.
- Handle potential null value without running into errors.