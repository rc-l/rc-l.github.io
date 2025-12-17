// ==UserScript==
// @name         Torn Lease Extension Autofill
// @namespace    brandhout.leaseextension
// @version      1.2.0
// @description  Automatically fills lease extension and new lease fields.
// @author       Brandhout
// @match        https://www.torn.com/properties.php*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    // Configuration constants
    const RATE_PER_DAY = 750000;   // Base rate $750k per day
    const DISCOUNT = 0.03;         // 3% discount
    const ROUNDING = 100000;       // Round to nearest $100k
    const TARGET_DAYS = 100;       // Target total lease length
    const RETRY_INTERVAL = 500;    // ms between retries
    const MAX_RETRIES = 10;        // Maximum retry attempts
    
    // State tracking
    let retryCount = 0;
    let debounceTimer = null;
    let lastFilledHash = '';
    
    // Wait for the page to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        console.log('Torn Lease Extension Autofill loaded');
        
        // Monitor hash changes for navigation
        window.addEventListener('hashchange', handleHashChange);
        
        // Initial check
        handleHashChange();
    }
    
    function handleHashChange() {
        // Debounce to prevent multiple executions
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            retryCount = 0;
            const hash = window.location.hash;
            
            if (hash.includes('tab=offerExtension')) {
                checkAndFillExtension();
            } else if (hash.includes('tab=lease')) {
                checkAndFillLease();
            }
        }, 100);
    }
    
    function checkAndFillExtension() {
        // Check if form is visible and ready
        const container = document.querySelector('.offerExtension-opt');
        if (!container || container.style.display === 'none') {
            // Retry if we haven't exceeded max retries
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                console.log(`Lease extension form not ready, retry ${retryCount}/${MAX_RETRIES}`);
                setTimeout(checkAndFillExtension, RETRY_INTERVAL);
            }
            return;
        }
        
        // Avoid filling the same form multiple times
        const currentHash = window.location.hash;
        if (lastFilledHash === currentHash) {
            return;
        }
        
        // Try to fill the form
        if (fillExtensionForm()) {
            lastFilledHash = currentHash;
            console.log('Lease extension form auto-filled successfully');
        } else if (retryCount < MAX_RETRIES) {
            // Retry if filling failed and we haven't exceeded max retries
            retryCount++;
            console.log(`Failed to fill form, retry ${retryCount}/${MAX_RETRIES}`);
            setTimeout(checkAndFillExtension, RETRY_INTERVAL);
        }
    }

    function checkAndFillLease() {
        // 1. Switch to "Add property to rental market" tab if needed
        const marketTabLink = document.querySelector('a#market1');
        const marketTabLi = document.querySelector('li#leasemarket');
        
        if (marketTabLink && marketTabLi && !marketTabLi.classList.contains('ui-tabs-active')) {
            console.log('Switching to Rental Market tab');
            marketTabLink.click();
            // Wait for tab switch animation/DOM update
            setTimeout(checkAndFillLease, 200);
            return;
        }

        // 2. Check if form is visible
        const container = document.querySelector('#market');
        if (!container || container.style.display === 'none') {
             if (retryCount < MAX_RETRIES) {
                retryCount++;
                console.log(`Lease market form not ready, retry ${retryCount}/${MAX_RETRIES}`);
                setTimeout(checkAndFillLease, RETRY_INTERVAL);
            }
            return;
        }

        // Avoid filling the same form multiple times
        const currentHash = window.location.hash;
        if (lastFilledHash === currentHash) {
            return;
        }

        // 3. Fill Form
        if (fillLeaseForm()) {
            lastFilledHash = currentHash;
            console.log('Lease market form auto-filled successfully');
        } else if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`Failed to fill lease form, retry ${retryCount}/${MAX_RETRIES}`);
            setTimeout(checkAndFillLease, RETRY_INTERVAL);
        }
    }
    
    function fillLeaseForm() {
        try {
            // Find inputs in the #market container
            const container = document.querySelector('#market');
            if (!container) return false;

            const daysInput = container.querySelector('input[data-name="days"]');
            const costInput = container.querySelector('input[data-name="money"]'); // Note: data-name is "money" here, not "offercost"

            if (!daysInput || !costInput) {
                console.log('Could not find lease form input fields');
                return false;
            }

            const totalCost = TARGET_DAYS * RATE_PER_DAY;
            console.log(`Setting Lease Days: ${TARGET_DAYS}`);
            console.log(`Setting Lease Cost: ${totalCost}`);

            setInputValue(daysInput, TARGET_DAYS);
            setInputValue(costInput, totalCost);

            return true;
        } catch (error) {
            console.error('Error filling lease form:', error);
            return false;
        }
    }
    
    function isOnExtensionTab() {
        const hash = window.location.hash;
        return hash.includes('tab=offerExtension');
    }
    
    function fillExtensionForm() {
        try {
            // Find days remaining
            const daysRemaining = extractDaysRemaining();
            if (daysRemaining === null) {
                console.log('Could not extract days remaining');
                return false;
            }
            
            console.log(`Days remaining: ${daysRemaining}`);
            
            // Calculate additional days needed
            const additionalDays = TARGET_DAYS - daysRemaining;
            
            if (additionalDays <= 0) {
                console.log(`Lease already at or above ${TARGET_DAYS} days, no extension needed`);
                return true; // Not an error, just nothing to do
            }
            
            // Calculate cost
            // Apply discount to total and round to nearest 100k
            const rawCost = additionalDays * RATE_PER_DAY * (1 - DISCOUNT);
            const cost = Math.round(rawCost / ROUNDING) * ROUNDING;
            
            console.log(`Additional days: ${additionalDays}`);
            console.log(`Base Rate: ${RATE_PER_DAY}, Raw Cost: ${rawCost}`);
            console.log(`Final Cost (Rounded): $${cost.toLocaleString()}`);
            
            // Fill the form fields
            const daysInput = document.querySelector('input[data-name="days"]');
            const costInput = document.querySelector('input[data-name="offercost"]');
            
            if (!daysInput || !costInput) {
                console.log('Could not find form input fields');
                return false;
            }
            
            // Set the values - tornInputMoney plugin uses visible input for display
            setInputValue(daysInput, additionalDays);
            setInputValue(costInput, cost);
            
            return true;
        } catch (error) {
            console.error('Error filling extension form:', error);
            return false;
        }
    }
    
    function extractDaysRemaining() {
        // Find the paragraph containing lease information
        const container = document.querySelector('.offerExtension-opt .cont-gray p');
        if (!container) {
            return null;
        }
        
        // Look for "X days" in a strong tag
        const strongTags = container.querySelectorAll('strong');
        for (const strong of strongTags) {
            const text = strong.textContent.trim();
            const match = text.match(/^(\d+)\s+days?$/i);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        
        return null;
    }
    
    function setInputValue(input, value) {
        // tornInputMoney creates multiple input elements (visible and hidden)
        // We need to set the visible one and trigger events for validation
        
        if (!input) return;
        
        // Find all inputs with the same data-name
        const dataName = input.getAttribute('data-name');
        const relatedInputs = document.querySelectorAll(`input[data-name="${dataName}"]`);
        
        // Set value on all related inputs
        relatedInputs.forEach(inp => {
            if (inp.type === 'hidden') {
                inp.value = value.toString();
            } else {
                // For visible input, format the number appropriately
                inp.value = value.toString();
                
                // Trigger input and change events for validation
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
                inp.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        });
    }
    
})();
