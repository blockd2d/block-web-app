/**
 * Router.js - Simple navigation helper
 */

(function(global) {
    'use strict';

    const Router = {};

    /**
     * Navigate to a page
     * @param {string} page - Page path
     */
    Router.navigate = function(page) {
        window.location.href = page;
    };

    /**
     * Get current page name from URL
     * @returns {string} Page name
     */
    Router.getCurrentPage = function() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
        return filename.replace('.html', '');
    };

    /**
     * Add query parameter to URL
     * @param {string} key - Parameter key
     * @param {string} value - Parameter value
     */
    Router.setQueryParam = function(key, value) {
        const url = new URL(window.location);
        url.searchParams.set(key, value);
        window.history.replaceState({}, '', url);
    };

    /**
     * Get query parameter from URL
     * @param {string} key - Parameter key
     * @returns {string|null} Parameter value
     */
    Router.getQueryParam = function(key) {
        const url = new URL(window.location);
        return url.searchParams.get(key);
    };

    /**
     * Remove query parameter from URL
     * @param {string} key - Parameter key
     */
    Router.removeQueryParam = function(key) {
        const url = new URL(window.location);
        url.searchParams.delete(key);
        window.history.replaceState({}, '', url);
    };

    /**
     * Highlight active navigation item
     */
    Router.highlightActiveNav = function() {
        const currentPage = Router.getCurrentPage();
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            const href = item.getAttribute('href') || '';
            const pageName = href.replace('.html', '').replace('/', '') || 'index';
            
            if (pageName === currentPage || 
                (currentPage === 'index' && pageName === 'index') ||
                (currentPage === 'add-sale' && pageName === 'sales') ||
                (currentPage === 'add-rep' && pageName === 'sales-reps')) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    };

    // Expose to global scope
    global.Router = Router;

})(window);
