/**
 * App.js - Main application initialization and CSV import handling
 */

(function(global) {
    'use strict';

    const App = {};

    /**
     * Initialize the application
     */
    App.init = function() {
        // Default to Block's dark theme for better contrast on maps
        try {
            document.body.classList.add('theme-dark');
        } catch (e) {}

        // Initialize UI components
        window.UI.initSidebar();
        window.UI.initMotion && window.UI.initMotion();
        
        // Setup CSV import handler
        App.setupCSVImport();
        
        // Highlight active navigation
        window.Router.highlightActiveNav();

        // Register service worker only on http/https
        if (!window.Utils.isFileProtocol() && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.log('Service worker registration skipped:', err.message);
            });
        }

        console.log('Block initialized');
    };

    /**
     * Setup CSV import handler
     */
    App.setupCSVImport = function() {
        const csvInput = document.getElementById('csvImport');
        if (!csvInput) return;

        csvInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                window.UI.showLoading('Importing CSV...');
                
                // Small delay to let UI update
                await window.Utils.delay(100);
                
                const text = await readFile(file);
                const result = processCSV(text);
                
                window.UI.hideLoading();
                
                // Show summary modal
                await showImportSummary(result);
                
                // Reset input
                csvInput.value = '';
                
            } catch (err) {
                window.UI.hideLoading();
                console.error('CSV import error:', err);
                window.UI.toastError(err.message, 'Import Failed');
                csvInput.value = '';
            }
        });
    };

    /**
     * Read file as text
     * @param {File} file - File object
     * @returns {Promise<string>} File content
     */
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Process CSV content
     * @param {string} csvText - CSV content
     * @returns {Object} Processing result
     */
    function processCSV(csvText) {
        const { headers, rows } = window.Utils.parseCSV(csvText);
        
        if (rows.length === 0) {
            throw new Error('CSV file is empty or has no data rows');
        }

        // Normalize headers for matching
        const normalizedHeaders = headers.map(h => window.Utils.normalizeHeader(h));
        const headerMap = {};
        headers.forEach((h, i) => {
            headerMap[normalizedHeaders[i]] = h;
        });

        // Detect columns (liberal matching - many CSVs use odd names)
        const latCol = detectColumn(headerMap, [
            'latitude', 'lat', 'y',
            'ycoord', 'y_coordinate', 'ycoordinate',
            'latdeg', 'latitudedeg', 'latitude_degrees',
            'latitude_decimal', 'latitude_dd'
        ]);
        const lngCol = detectColumn(headerMap, [
            'longitude', 'lng', 'lon', 'long', 'x',
            'xcoord', 'x_coordinate', 'xcoordinate',
            'londeg', 'longitudedeg', 'longitude_degrees',
            'longitude_decimal', 'longitude_dd'
        ]);
        const addressCol = detectColumn(headerMap, ['address', 'street', 'fulladdress', 'streetaddress', 'propertyaddress', 'location']);
        const idCol = detectColumn(headerMap, ['id', 'propertyid', 'houseid', 'parcelid', 'uid', 'recordid']);
        const priceCol = detectColumn(headerMap, [
            'propertyvalue', 'price', 'value', 'marketvalue', 'housevalue', 
            'homevalue', 'assessedvalue', 'saleprice', 'listprice', 'amount',
            'estimatedvalue', 'appraisedvalue', 'taxvalue'
        ]);

        if (!latCol || !lngCol) {
            const shown = headers.slice(0, 20).join(', ');
            throw new Error(
                'Could not detect latitude/longitude columns. ' +
                'Expected headers like lat/lng or latitude/longitude. ' +
                'Found: ' + shown + (headers.length > 20 ? ', …' : '')
            );
        }

        // Process rows into properties
        const properties = [];
        let validCoordCount = 0;
        let priceCount = 0;

        rows.forEach((row, index) => {
            const lat = parseFloat(row[latCol]);
            const lng = parseFloat(row[lngCol]);

            // Validate coordinates
            if (isNaN(lat) || isNaN(lng)) return;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

            validCoordCount++;

            // Parse price
            let price = null;
            if (priceCol) {
                const priceStr = row[priceCol];
                if (priceStr) {
                    price = window.Utils.parseNumber(priceStr);
                    if (!isNaN(price) && price > 0) {
                        priceCount++;
                    } else {
                        price = null;
                    }
                }
            }

            // Generate ID
            let id = idCol ? row[idCol] : null;
            if (!id) {
                id = window.Utils.uid('prop');
            }

            // Get address
            const address = addressCol ? row[addressCol] : '';

            properties.push({
                id: String(id),
                address: address,
                lat: lat,
                lng: lng,
                price: price,
                raw: row
            });
        });

        if (validCoordCount === 0) {
            throw new Error('No valid coordinates found in the CSV. Please check your latitude/longitude data.');
        }

        return {
            totalRows: rows.length,
            validCoordCount: validCoordCount,
            priceDetected: priceCol !== null,
            priceCount: priceCount,
            properties: properties,
            detectedColumns: {
                lat: latCol,
                lng: lngCol,
                address: addressCol,
                id: idCol,
                price: priceCol
            }
        };
    }

    /**
     * Detect column from possible names
     * @param {Object} headerMap - Normalized header map
     * @param {Array} possibleNames - Possible column names (normalized)
     * @returns {string|null} Original column name or null
     */
    function detectColumn(headerMap, possibleNames) {
        // 1) Exact normalized match
        for (const name of possibleNames) {
            if (headerMap[name]) {
                return headerMap[name];
            }
        }

        // 2) Fuzzy match: header contains or starts/ends with a candidate
        const keys = Object.keys(headerMap);
        for (const key of keys) {
            for (const name of possibleNames) {
                if (key === name) return headerMap[key];
                if (key.startsWith(name) || key.endsWith(name) || key.includes(name)) {
                    return headerMap[key];
                }
            }
        }
        return null;
    }

    /**
     * Show import summary modal
     * @param {Object} result - Processing result
     */
    async function showImportSummary(result) {
        const priceStatus = result.priceDetected 
            ? `<span class="pill pill-success">Yes (${result.priceCount.toLocaleString()} values)</span>`
            : `<span class="pill pill-warning">No</span>`;

        const content = `
            <div class="import-summary">
                <div class="summary-row">
                    <span class="summary-label">Total Rows:</span>
                    <span class="summary-value">${result.totalRows.toLocaleString()}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Valid Coordinates:</span>
                    <span class="summary-value">${result.validCoordCount.toLocaleString()}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Price Detected:</span>
                    <span class="summary-value">${priceStatus}</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-columns">
                    <span class="summary-label">Detected Columns:</span>
                    <ul class="column-list">
                        <li>Latitude: <code>${result.detectedColumns.lat || 'Not found'}</code></li>
                        <li>Longitude: <code>${result.detectedColumns.lng || 'Not found'}</code></li>
                        <li>Address: <code>${result.detectedColumns.address || 'Not found'}</code></li>
                        <li>ID: <code>${result.detectedColumns.id || 'Auto-generated'}</code></li>
                        <li>Price: <code>${result.detectedColumns.price || 'Not found'}</code></li>
                    </ul>
                </div>
            </div>
            <style>
                .import-summary { font-size: 14px; }
                .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
                .summary-label { color: #64748B; }
                .summary-value { font-weight: 600; color: #1E293B; }
                .summary-divider { height: 1px; background: #E2E8F0; margin: 12px 0; }
                .summary-columns { padding-top: 8px; }
                .column-list { margin: 8px 0 0 0; padding-left: 20px; }
                .column-list li { padding: 4px 0; color: #475569; }
                .column-list code { background: #F1F5F9; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
            </style>
        `;

        const confirmed = await window.UI.modal({
            title: 'Import Summary',
            content: content,
            footer: `
                <button class="btn btn-secondary" id="modalCancel">Cancel</button>
                <button class="btn btn-primary" id="modalConfirm">Import ${result.validCoordCount.toLocaleString()} Properties</button>
            `
        });

        if (confirmed) {
            // Save properties to store
            window.Store.setProperties(result.properties);
            window.UI.toastSuccess(
                `Successfully imported ${result.validCoordCount.toLocaleString()} properties`,
                'Import Complete'
            );

            // Emit event for page-specific handling
            window.dispatchEvent(new CustomEvent('propertiesImported', { 
                detail: result 
            }));
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', App.init);
    } else {
        App.init();
    }

    // Expose to global scope
    global.App = App;

})(window);
