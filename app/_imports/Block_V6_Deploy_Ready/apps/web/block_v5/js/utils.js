/**
 * Utils.js - Core utility functions
 * This file MUST be loaded before any other JS files
 */

(function(global) {
    'use strict';

    // Define Utils namespace first to avoid TDZ issues
    const Utils = {};

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    Utils.escapeHTML = function(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    };

    /**
     * Generate a unique ID
     * @param {string} prefix - Optional prefix
     * @returns {string} Unique ID
     */
    Utils.uid = function(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 9);
        return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
    };

    /**
     * Format number as currency
     * @param {number} value - Number to format
     * @param {string} currency - Currency code
     * @returns {string} Formatted currency string
     */
    Utils.formatMoney = function(value, currency = 'USD') {
        const num = Utils.parseNumber(value);
        if (isNaN(num)) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    };

    /**
     * Format number with thousands separator
     * @param {number} value - Number to format
     * @returns {string} Formatted number string
     */
    Utils.formatNumber = function(value) {
        const num = Utils.parseNumber(value);
        if (isNaN(num)) return '0';
        return new Intl.NumberFormat('en-US').format(num);
    };

    /**
     * Parse a value to number
     * @param {*} value - Value to parse
     * @returns {number} Parsed number or NaN
     */
    Utils.parseNumber = function(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            // Remove currency symbols, commas, spaces
            const cleaned = value.replace(/[$,\s]/g, '');
            return parseFloat(cleaned);
        }
        return NaN;
    };

    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    Utils.clamp = function(value, min, max) {
        return Math.min(Math.max(value, min), max);
    };

    /**
     * Debounce a function
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in ms
     * @returns {Function} Debounced function
     */
    Utils.debounce = function(fn, delay) {
        let timeoutId = null;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    /**
     * Throttle a function
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Limit in ms
     * @returns {Function} Throttled function
     */
    Utils.throttle = function(fn, limit) {
        let inThrottle = false;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    /**
     * Generate a stable hash from a string
     * @param {string} str - String to hash
     * @returns {number} Hash value
     */
    Utils.stableHash = function(str) {
        let hash = 0;
        const s = String(str);
        for (let i = 0; i < s.length; i++) {
            const char = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    };

    /**
     * Deep clone an object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    Utils.deepClone = function(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (Array.isArray(obj)) return obj.map(item => Utils.deepClone(item));
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = Utils.deepClone(obj[key]);
            }
        }
        return cloned;
    };

    /**
     * Format a date as YYYY-MM-DD
     * @param {Date|string} date - Date to format
     * @returns {string} Formatted date
     */
    Utils.formatDate = function(date) {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    /**
     * Format a date for display
     * @param {Date|string} date - Date to format
     * @returns {string} Formatted date
     */
    Utils.formatDateDisplay = function(date) {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    /**
     * Check if running on file:// protocol
     * @returns {boolean} True if on file://
     */
    Utils.isFileProtocol = function() {
        return window.location.protocol === 'file:';
    };

    /**
     * Normalize a header string for comparison
     * @param {string} header - Header to normalize
     * @returns {string} Normalized header
     */
    Utils.normalizeHeader = function(header) {
        if (!header) return '';
        // Handle BOM, odd punctuation, and inconsistent spacing/casing
        return String(header)
            .replace(/^﻿/, '')
            .toLowerCase()
            .trim()
            // collapse all non-alphanumeric characters (spaces, underscores, dashes, punctuation)
            .replace(/[^a-z0-9]/g, '');
    };

    /**
     * Get initials from a name
     * @param {string} name - Full name
     * @returns {string} Initials (max 2 characters)
     */
    Utils.getInitials = function(name) {
        if (!name) return '?';
        const parts = String(name).trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    /**
     * Generate a random color from palette
     * @returns {string} Hex color
     */
    Utils.randomColor = function() {
        const palette = [
            '#4F46E5', '#7C3AED', '#DB2777', '#DC2626',
            '#EA580C', '#D97706', '#65A30D', '#059669',
            '#0891B2', '#0284C7', '#2563EB', '#4338CA'
        ];
        return palette[Math.floor(Math.random() * palette.length)];
    };

    /**
     * Haversine distance between two lat/lng points in miles
     * @param {number} lat1 - Latitude of point 1
     * @param {number} lng1 - Longitude of point 1
     * @param {number} lat2 - Latitude of point 2
     * @param {number} lng2 - Longitude of point 2
     * @returns {number} Distance in miles
     */
    Utils.haversineDistance = function(lat1, lng1, lat2, lng2) {
        const R = 3958.8; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    /**
     * Delay execution (promisified setTimeout)
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise that resolves after delay
     */
    Utils.delay = function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    /**
     * Download data as a file
     * @param {string} data - Data to download
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    Utils.downloadFile = function(data, filename, mimeType = 'text/plain') {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Converts CSV data to array of objects
     * @param {string} csvText - CSV text content
     * @returns {Object} { headers: string[], rows: Object[] }
     */
    Utils.parseCSV = function(csvText) {
        // Supports comma/semicolon/tab/pipe delimited files and quoted fields.
        // Auto-detect delimiter from the header line.

        if (!csvText) return { headers: [], rows: [], delimiter: ',' };

        // Normalize line endings
        const text = String(csvText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Grab the first non-empty line (usually headers)
        const firstLine = text.split('\n').find(l => l && l.trim().length > 0);
        if (!firstLine) return { headers: [], rows: [], delimiter: ',' };

        const delimiter = (function detectDelimiter(line) {
            const candidates = [',', ';', '\t', '|'];
            const counts = new Map(candidates.map(c => [c, 0]));
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    // handle escaped quotes ""
                    if (inQuotes && line[i + 1] === '"') {
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (!inQuotes && counts.has(ch)) {
                    counts.set(ch, counts.get(ch) + 1);
                }
            }
            // Pick delimiter with the most separators; default comma.
            let best = ',';
            let bestCount = -1;
            for (const [c, n] of counts.entries()) {
                if (n > bestCount) {
                    best = c;
                    bestCount = n;
                }
            }
            return bestCount > 0 ? best : ',';
        })(firstLine);

        // Split into logical lines while respecting quotes
        // NOTE: We must PRESERVE quote characters in the line buffer.
        // If quotes are stripped here, commas inside quoted fields (e.g., addresses) will be mis-parsed.
        const lines = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === '"') {
                // Preserve the quote character so the row parser can correctly interpret quoted fields.
                if (inQuotes && text[i + 1] === '"') {
                    // Escaped quote inside a quoted field -> keep both quotes
                    current += '""';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                    current += '"';
                }
            } else if (char === '\n' && !inQuotes) {
                if (current.trim() || lines.length > 0) {
                    lines.push(current);
                }
                current = '';
            } else {
                current += char;
            }
        }
        if (current.trim()) {
            lines.push(current);
        }if (lines.length === 0) {
            return { headers: [], rows: [], delimiter };
        }

        // Parse each line into cells for the detected delimiter
        const parseRow = (line) => {
            const cells = [];
            let cell = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        cell += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    cells.push(cell.trim());
                    cell = '';
                } else {
                    cell += char;
                }
            }
            cells.push(cell.trim());
            return cells;
        };

        // Headers
        const rawHeaders = parseRow(lines[0]);
        const headers = rawHeaders.map(h => String(h).replace(/^\uFEFF/, '').trim());

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cells = parseRow(lines[i]);
            if (cells.some(c => c !== '')) {
                const row = {};
                headers.forEach((header, idx) => {
                    row[header] = (cells[idx] ?? '').trim();
                });
                rows.push(row);
            }
        }

        return { headers, rows, delimiter };
    };

    // Expose Utils globally
    global.Utils = Utils;

})(window);
