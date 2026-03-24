// ==UserScript==
// @name         Torn Advanced Search Filter
// @namespace    brandhout.searchfilter
// @version      2.1.0
// @description  Enhance torn.com search with additional filters to limit search results on multiple user statuses at the same time (e.g., Federal Jail, Traveling, RIP) and adds attack buttons next to user names for quick access. Features custom result list for better performance and layout.
// @author       Brandhout
// @match        https://www.torn.com/page.php?sid=UserList*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    // Load saved filter state from localStorage
    const savedState = localStorage.getItem('tornAdvancedFilters');
    
    // Filter state with defaults
    const defaultState = {
        federalJail: false,
        traveling: false,
        rip: false,
        showAttackButtons: true
    };
    
    // Merge saved state with defaults to ensure all keys exist
    const filterState = savedState ? { ...defaultState, ...JSON.parse(savedState) } : defaultState;
    
    // Wait for the page to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        // Verify we're on the UserList page
        const body = document.querySelector('body[data-page="UserList"]');
        if (!body) {
            console.log('Not on UserList page, script will not run');
            return;
        }
        
        console.log('Torn Advanced Search Filter loaded');
        
        // Create the filter bar
        createFilterBar();
        
        // Set up observer to detect when search results load or change
        setupSearchResultsObserver();
    }
    
    function setupSearchResultsObserver() {
        // Find the content wrapper where search results appear
        const contentWrapper = document.querySelector('.content-wrapper');
        if (!contentWrapper) {
            console.error('Could not find content wrapper for observer');
            return;
        }
        
        let debounceTimer = null;
        
        // Create observer to watch for changes in the search results area
        const observer = new MutationObserver((mutations) => {
            // Check if user lists are present
            const userLists = document.querySelectorAll('.user-info-list-wrap');
            if (userLists.length > 0) {
                // Debounce the rebuild to avoid excessive calls
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    console.log('Search results detected, building custom list...');
                    buildCustomResultList();
                }, 200);
            }
        });
        
        // Start observing
        observer.observe(contentWrapper, {
            childList: true,
            subtree: true
        });
        
        // Also try to build immediately if results are already present
        setTimeout(() => {
            const userLists = document.querySelectorAll('.user-info-list-wrap');
            if (userLists.length > 0) {
                console.log('Search results already present, building custom list...');
                buildCustomResultList();
            }
        }, 500);
    }
    
    function createFilterBar() {
        // Check if filter bar already exists
        if (document.getElementById('advanced-filter-bar')) {
            console.log('Filter bar already exists, skipping creation');
            return;
        }
        
        // Find where to insert the filter bar (top of content-wrapper)
        const contentWrapper = document.querySelector('.content-wrapper');
        if (!contentWrapper) {
            console.error('Could not find content wrapper');
            return;
        }
        
        // Create the filter bar container
        const filterBar = document.createElement('div');
        filterBar.id = 'advanced-filter-bar';
        filterBar.style.cssText = `
            background-color: #1a1a1a;
            color: #ffffff;
            padding: 12px 20px;
            width: 100%;
            box-sizing: border-box;
            border-bottom: 2px solid #333;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        
        // Create title
        const title = document.createElement('div');
        title.textContent = 'Advanced Filter';
        title.style.cssText = `
            font-weight: bold;
            color: #cccccc;
            font-size: 16px;
        `;
        
        // Create toggles container that wraps
        const togglesContainer = document.createElement('div');
        togglesContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: center;
        `;
        
        // Create Federal Jail filter toggle
        const federalJailFilter = createToggle('Federal Jail', 'federalJail');
        
        // Create Traveling filter toggle
        const travelingFilter = createToggle('Traveling', 'traveling');
        
        // Create RIP filter toggle
        const ripFilter = createToggle('RIP', 'rip');

        // Create Attack Buttons toggle
        const attackButtonsFilter = createToggle('Attack Buttons', 'showAttackButtons');
        
        // Add toggles to the toggles container
        togglesContainer.appendChild(federalJailFilter);
        togglesContainer.appendChild(travelingFilter);
        togglesContainer.appendChild(ripFilter);
        togglesContainer.appendChild(attackButtonsFilter);
        
        // Assemble the filter bar
        filterBar.appendChild(title);
        filterBar.appendChild(togglesContainer);
        
        // Insert at the beginning of content-wrapper
        contentWrapper.insertBefore(filterBar, contentWrapper.firstChild);
        
        console.log('Filter bar created');
    }
    
    function createToggle(label, filterKey) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `filter-${filterKey}`;
        checkbox.checked = filterState[filterKey];
        checkbox.style.cssText = `
            width: 18px;
            height: 18px;
            cursor: pointer;
        `;
        
        checkbox.addEventListener('change', function() {
            filterState[filterKey] = this.checked;
            // Save to localStorage
            localStorage.setItem('tornAdvancedFilters', JSON.stringify(filterState));
            
            // Apply filters or toggle attack buttons
            if (filterKey === 'showAttackButtons') {
                toggleAttackButtons();
            } else {
                applyFilters();
            }
        });
        
        // Create label
        const labelElement = document.createElement('label');
        labelElement.htmlFor = `filter-${filterKey}`;
        labelElement.textContent = label;
        labelElement.style.cssText = `
            cursor: pointer;
            user-select: none;
        `;
        
        container.appendChild(checkbox);
        container.appendChild(labelElement);
        
        return container;
    }
    
    function extractUserData() {
        // Extract user data from original Torn search results
        const userLists = document.querySelectorAll('.user-info-list-wrap');
        const users = [];
        
        userLists.forEach(userList => {
            const listItems = userList.querySelectorAll('li');
            
            listItems.forEach(listItem => {
                // Extract user link and ID
                const userLink = listItem.querySelector('a.user.name[href*="XID="]');
                if (!userLink) return;
                
                const href = userLink.getAttribute('href');
                const match = href.match(/XID=(\d+)/);
                if (!match) return;
                
                const userId = match[1];
                const username = userLink.textContent.trim();
                
                // Extract faction name
                let factionName = 'N/A';
                const factionLink = listItem.querySelector('a[href*="factions.php"]');
                if (factionLink) {
                    factionName = factionLink.textContent.trim();
                }
                
                // Check status for filtering
                const textContent = listItem.textContent || '';
                const innerHTML = listItem.innerHTML || '';
                
                const statuses = {
                    federalJail: textContent.includes('Federal') || textContent.includes('federal') || 
                                 innerHTML.includes('icon16') ||
                                 listItem.querySelector('[title*="Federal"]') !== null,
                    traveling: textContent.includes('Traveling') || textContent.includes('traveling') ||
                               textContent.includes('Abroad') || textContent.includes('abroad') ||
                               listItem.querySelector('[title*="Traveling"]') !== null ||
                               listItem.querySelector('[title*="abroad"]') !== null,
                    rip: textContent.includes('Resting in peace') || textContent.includes('resting in peace') ||
                         listItem.querySelector('[title*="Resting in peace"]') !== null
                };
                
                users.push({
                    userId,
                    username,
                    profileUrl: href,
                    factionName,
                    statuses
                });
            });
        });
        
        return users;
    }
    
    function showOriginalFilteredResults() {
        // Hide custom container if it exists
        const customContainer = document.getElementById('custom-search-results');
        if (customContainer) {
            customContainer.style.display = 'none';
        }
        
        // Show and filter original user lists
        const userLists = document.querySelectorAll('.user-info-list-wrap');
        
        userLists.forEach(userList => {
            userList.style.display = '';
            const listItems = userList.querySelectorAll('li');
            
            listItems.forEach(listItem => {
                let shouldHide = false;
                
                const textContent = listItem.textContent || '';
                const innerHTML = listItem.innerHTML || '';
                
                // Check Federal Jail filter
                if (filterState.federalJail) {
                    if (textContent.includes('Federal') || 
                        textContent.includes('federal') ||
                        innerHTML.includes('icon16') ||
                        listItem.querySelector('[title*="Federal"]')) {
                        shouldHide = true;
                    }
                }
                
                // Check Traveling filter
                if (filterState.traveling && !shouldHide) {
                    if (textContent.includes('Traveling') || 
                        textContent.includes('traveling') ||
                        textContent.includes('Abroad') ||
                        textContent.includes('abroad') ||
                        listItem.querySelector('[title*="Traveling"]') ||
                        listItem.querySelector('[title*="abroad"]')) {
                        shouldHide = true;
                    }
                }
                
                // Check RIP filter
                if (filterState.rip && !shouldHide) {
                    if (textContent.includes('Resting in peace') || 
                        textContent.includes('resting in peace') ||
                        listItem.querySelector('[title*="Resting in peace"]')) {
                        shouldHide = true;
                    }
                }
                
                // Apply visibility
                listItem.style.display = shouldHide ? 'none' : '';
            });
        });
        
        console.log('Original filtered results shown');
    }
    
    function buildCustomResultList() {
        // Extract user data from original results
        const users = extractUserData();
        
        if (users.length === 0) {
            console.log('No users found to display');
            return;
        }
        
        // If attack buttons are disabled, show original filtered results instead
        if (!filterState.showAttackButtons) {
            showOriginalFilteredResults();
            return;
        }
        
        // Hide original user lists
        const originalLists = document.querySelectorAll('.user-info-list-wrap');
        originalLists.forEach(list => {
            list.style.display = 'none';
        });
        
        // Check if custom container already exists
        let customContainer = document.getElementById('custom-search-results');
        if (!customContainer) {
            // Create custom container
            customContainer = document.createElement('div');
            customContainer.id = 'custom-search-results';
            customContainer.style.cssText = `
                background-color: #1a1a1a;
                color: #ffffff;
                border-radius: 5px;
                overflow: hidden;
            `;
            
            // Find the first .user-info-list-wrap to insert in the same location
            const firstOriginalList = document.querySelector('.user-info-list-wrap');
            if (firstOriginalList && firstOriginalList.parentNode) {
                firstOriginalList.parentNode.insertBefore(customContainer, firstOriginalList);
            } else {
                // Fallback: insert after filter bar
                const filterBar = document.getElementById('advanced-filter-bar');
                const contentWrapper = document.querySelector('.content-wrapper');
                
                if (filterBar && filterBar.nextSibling) {
                    contentWrapper.insertBefore(customContainer, filterBar.nextSibling);
                } else if (contentWrapper) {
                    contentWrapper.insertBefore(customContainer, contentWrapper.firstChild);
                }
            }
        } else {
            // Make sure custom container is visible
            customContainer.style.display = '';
        }
        
        // Clear existing content
        customContainer.innerHTML = '';
        
        // Apply filtering
        const filteredUsers = users.filter(user => {
            if (filterState.federalJail && user.statuses.federalJail) return false;
            if (filterState.traveling && user.statuses.traveling) return false;
            if (filterState.rip && user.statuses.rip) return false;
            return true;
        });
        
        console.log(`Displaying ${filteredUsers.length} of ${users.length} users after filtering`);
        
        // Build the custom list
        if (filteredUsers.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.style.cssText = `
                padding: 20px;
                text-align: center;
                color: #888;
            `;
            emptyMessage.textContent = 'No users match the current filters.';
            customContainer.appendChild(emptyMessage);
            return;
        }
        
        // Create table for clean layout
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        `;
        
        // Create header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr style="background-color: #252525; border-bottom: 2px solid #333;">
                <th style="padding: 12px; text-align: left; color: #ccc; font-weight: 600;">Faction</th>
                <th style="padding: 12px; text-align: left; color: #ccc; font-weight: 600;">Username</th>
                <th style="padding: 12px; text-align: center; color: #ccc; font-weight: 600; width: 100px;">Action</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        
        filteredUsers.forEach((user, index) => {
            const row = document.createElement('tr');
            row.style.cssText = `
                border-bottom: 1px solid #2a2a2a;
                transition: background-color 0.2s;
            `;
            
            // Alternating row colors
            if (index % 2 === 0) {
                row.style.backgroundColor = '#1a1a1a';
            } else {
                row.style.backgroundColor = '#1f1f1f';
            }
            
            // Add hover effect
            row.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#2a2a2a';
            });
            row.addEventListener('mouseleave', function() {
                if (index % 2 === 0) {
                    this.style.backgroundColor = '#1a1a1a';
                } else {
                    this.style.backgroundColor = '#1f1f1f';
                }
            });
            
            // Faction cell
            const factionCell = document.createElement('td');
            factionCell.style.cssText = `
                padding: 10px 12px;
                color: #aaa;
            `;
            factionCell.textContent = user.factionName;
            
            // Username cell
            const usernameCell = document.createElement('td');
            usernameCell.style.cssText = `
                padding: 10px 12px;
            `;
            
            const userLinkElement = document.createElement('a');
            userLinkElement.href = user.profileUrl;
            userLinkElement.textContent = user.username;
            userLinkElement.style.cssText = `
                color: #ddd;
                text-decoration: none;
                font-weight: 500;
            `;
            userLinkElement.addEventListener('mouseenter', function() {
                this.style.color = '#fff';
                this.style.textDecoration = 'underline';
            });
            userLinkElement.addEventListener('mouseleave', function() {
                this.style.color = '#ddd';
                this.style.textDecoration = 'none';
            });
            
            usernameCell.appendChild(userLinkElement);
            
            // Attack button cell
            const attackCell = document.createElement('td');
            attackCell.style.cssText = `
                padding: 10px 12px;
                text-align: center;
            `;
            
            // Only add attack button if the toggle is enabled
            if (filterState.showAttackButtons) {
                const attackButton = document.createElement('button');
                attackButton.textContent = 'Attack';
                attackButton.style.cssText = `
                    background-color: #8b0000;
                    color: #fff;
                    border: none;
                    padding: 6px 16px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: background-color 0.2s;
                `;
                
                attackButton.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = '#b22222';
                });
                attackButton.addEventListener('mouseleave', function() {
                    this.style.backgroundColor = '#8b0000';
                });
                
                attackButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    window.location.href = `https://www.torn.com/loader.php?sid=attack&user2ID=${user.userId}`;
                });
                
                attackCell.appendChild(attackButton);
            }
            
            // Assemble row
            row.appendChild(factionCell);
            row.appendChild(usernameCell);
            row.appendChild(attackCell);
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        customContainer.appendChild(table);
        
        console.log('Custom result list built successfully');
    }
    
    function applyFilters() {
        // Rebuild the custom list with new filter settings
        buildCustomResultList();
    }
    
    function toggleAttackButtons() {
        // Rebuild the custom list to show/hide attack buttons
        buildCustomResultList();
    }
})();
