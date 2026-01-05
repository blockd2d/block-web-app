/**
 * Cluster Creation Page - Generate clusters from properties
 */

(function() {
    'use strict';

    let mapView = null;
    let selectedClusterId = null;

    /**
     * Initialize cluster creation page
     */
    function init() {
        initMap();
        initControls();
        updateDatasetStatus();
        updateClusterList();
        updatePriceStatus();

        // Listen for property import
        window.addEventListener('propertiesImported', () => {
            updateDatasetStatus();
            updatePriceStatus();
        });

        // Listen for cluster changes
        window.Store.on('clusters:changed', () => {
            updateClusterList();
            updateMap();
        });
    }

    /**
     * Initialize the map
     */
    function initMap() {
        const canvas = document.getElementById('mapCanvas');
        if (!canvas) return;

        mapView = new window.MapView('mapCanvas', {
            showProperties: true,
            showClusters: true,
            showReps: false
        });

        mapView.onClusterSelect = (clusterId) => {
            selectCluster(clusterId);
        };

        updateMap();
    }

    /**
     * Initialize control inputs and buttons
     */
    function initControls() {
        const generateBtn = document.getElementById('generateClusters');
        const clearBtn = document.getElementById('clearClusters');
        const radiusInput = document.getElementById('radiusMiles');
        const minHousesInput = document.getElementById('minHouses');
        const priceFromInput = document.getElementById('priceFrom');
        const priceToInput = document.getElementById('priceTo');

        if (generateBtn) {
            generateBtn.addEventListener('click', generateClusters);
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', clearClusters);
        }

        // Enable/disable generate button based on data
        updateGenerateButton();
    }

    /**
     * Update dataset status indicator
     */
    function updateDatasetStatus() {
        const statusEl = document.getElementById('datasetStatus');
        if (!statusEl) return;

        const properties = window.Store.getProperties();
        const count = properties.length;

        if (count > 0) {
            statusEl.innerHTML = `
                <div class="status-indicator status-ready">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>${count.toLocaleString()} properties loaded</span>
                </div>
            `;
        } else {
            statusEl.innerHTML = `
                <div class="status-indicator status-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>No properties imported. Use "Import CSV" to add properties.</span>
                </div>
            `;
        }

        updateGenerateButton();
    }

    /**
     * Update price status indicator
     */
    function updatePriceStatus() {
        const statusEl = document.getElementById('priceStatus');
        const priceFromInput = document.getElementById('priceFrom');
        const priceToInput = document.getElementById('priceTo');
        
        if (!statusEl) return;

        const hasPrice = window.Store.hasPrice();

        if (hasPrice) {
            statusEl.style.display = 'none';
            if (priceFromInput) priceFromInput.disabled = false;
            if (priceToInput) priceToInput.disabled = false;
        } else {
            statusEl.style.display = 'block';
            if (priceFromInput) priceFromInput.disabled = true;
            if (priceToInput) priceToInput.disabled = true;
        }
    }

    /**
     * Update generate button state
     */
    function updateGenerateButton() {
        const generateBtn = document.getElementById('generateClusters');
        if (!generateBtn) return;

        const properties = window.Store.getProperties();
        generateBtn.disabled = properties.length === 0;
    }

    /**
     * Generate clusters
     */
    async function generateClusters() {
        const generateBtn = document.getElementById('generateClusters');
        const radiusInput = document.getElementById('radiusMiles');
        const minHousesInput = document.getElementById('minHouses');
        const priceFromInput = document.getElementById('priceFrom');
        const priceToInput = document.getElementById('priceTo');

        // Get parameters
        const epsMiles = parseFloat(radiusInput.value) || 0.2;
        const minPts = parseInt(minHousesInput.value) || 25;
        const priceFrom = parseFloat(priceFromInput.value) || 0;
        const priceTo = parseFloat(priceToInput.value) || Infinity;

        // Disable button
        generateBtn.disabled = true;
        generateBtn.innerHTML = `
            <svg class="btn-icon-left spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            Generating...
        `;

        // Add spin animation
        const style = document.createElement('style');
        style.textContent = '.spin { animation: spin 1s linear infinite; }';
        document.head.appendChild(style);

        window.UI.toastInfo('Starting cluster generation...', 'Clustering');

        try {
            // Yield to event loop
            await window.Utils.delay(50);

            let properties = window.Store.getProperties();

            // Filter by price if price data available
            if (window.Store.hasPrice()) {
                properties = window.DBSCAN.filterByPrice(properties, priceFrom, priceTo);
                console.log(`Filtered to ${properties.length} properties by price range $${priceFrom} - $${priceTo}`);
            }

            if (properties.length === 0) {
                throw new Error('No properties match the price filter criteria');
            }

            // Run clustering with auto-retry
            let clusters = [];
            let attempts = 0;
            let currentRadius = epsMiles;

            while (clusters.length === 0 && attempts < 3) {
                attempts++;
                console.log(`Clustering attempt ${attempts} with radius ${currentRadius.toFixed(2)} miles, minPts ${minPts}`);
                
                await window.Utils.delay(10);
                
                clusters = window.DBSCAN.cluster(properties, currentRadius, minPts);
                
                if (clusters.length === 0 && attempts < 3) {
                    currentRadius *= 1.5; // Increase radius
                    window.UI.toastInfo(`No clusters found. Trying radius ${currentRadius.toFixed(2)} miles...`, 'Retrying');
                }
            }

            if (clusters.length === 0) {
                window.UI.toastWarning(
                    'No clusters found. Try increasing the radius or decreasing minimum houses.',
                    'No Clusters'
                );
            } else {
                // Save clusters
                window.Store.setClusters(clusters);

                const stats = window.DBSCAN.getStats(clusters, properties);
                window.UI.toastSuccess(
                    `Generated ${clusters.length} clusters with ${stats.clusteredPoints.toLocaleString()} properties`,
                    'Clustering Complete'
                );

                // Fit map to clusters
                if (mapView) {
                    mapView.fitToData();
                }
            }

        } catch (err) {
            console.error('Clustering error:', err);
            window.UI.toastError(err.message, 'Clustering Failed');
        }

        // Reset button
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="6"/>
                <circle cx="12" cy="12" r="2"/>
            </svg>
            Generate Clusters
        `;
        
        updateGenerateButton();
    }

    /**
     * Clear all clusters
     */
    async function clearClusters() {
        const confirmed = await window.UI.confirm({
            title: 'Clear Clusters',
            message: 'Are you sure you want to clear all generated clusters? This will also remove cluster assignments.',
            confirmText: 'Clear',
            confirmClass: 'btn-danger'
        });

        if (confirmed) {
            window.Store.clearClusters();
            selectedClusterId = null;
            window.UI.toastSuccess('All clusters cleared', 'Clusters Cleared');
        }
    }

    /**
     * Update map with current data
     */
    function updateMap() {
        if (!mapView) return;

        const properties = window.Store.getProperties();
        const clusters = window.Store.getClusters();

        mapView.setProperties(properties);
        mapView.setClusters(clusters);

        if (selectedClusterId) {
            mapView.selectCluster(selectedClusterId);
        }
    }

    /**
     * Update cluster list UI
     */
    function updateClusterList() {
        const listEl = document.getElementById('clusterList');
        const countEl = document.getElementById('clusterCount');
        if (!listEl) return;

        const clusters = window.Store.getClusters();

        if (countEl) {
            countEl.textContent = `${clusters.length} cluster${clusters.length !== 1 ? 's' : ''}`;
        }

        if (clusters.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="6"/>
                        <circle cx="12" cy="12" r="2"/>
                    </svg>
                    <span>No clusters generated yet</span>
                </div>
            `;
            return;
        }

        listEl.innerHTML = clusters.map((cluster, index) => {
            const stats = window.Store.getClusterStats(cluster.id);
            const isSelected = cluster.id === selectedClusterId;
            
            return `
                <div class="cluster-list-item ${isSelected ? 'selected' : ''}" 
                     data-cluster-id="${cluster.id}">
                    <div class="cluster-list-item-header">
                        <span class="cluster-color-dot" style="background-color: ${cluster.color}"></span>
                        <span class="cluster-list-item-name">Cluster ${index + 1}</span>
                    </div>
                    <div class="cluster-list-item-stats">
                        <span>${stats ? stats.housesCount : 0} houses</span>
                        ${stats && stats.totalValue > 0 ? `<span>${window.Utils.formatMoney(stats.totalValue)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        listEl.querySelectorAll('.cluster-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const clusterId = item.dataset.clusterId;
                selectCluster(clusterId);
            });
        });
    }

    /**
     * Select a cluster
     */
    function selectCluster(clusterId) {
        selectedClusterId = clusterId;

        // Update list UI
        const items = document.querySelectorAll('.cluster-list-item');
        items.forEach(item => {
            if (item.dataset.clusterId === clusterId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Update map
        if (mapView) {
            mapView.selectCluster(clusterId);
        }

        // Update inspector
        renderClusterInspector(clusterId);
    }

    /**
     * Render cluster inspector panel inside the map
     */
    function renderClusterInspector(clusterId) {
        const bodyEl = document.getElementById('clusterInspectorBody');
        if (!bodyEl) return;

        if (!clusterId) {
            bodyEl.innerHTML = `<div class="text-muted">Click a cluster on the map to inspect it.</div>`;
            return;
        }

        const cluster = window.Store.getCluster(clusterId);
        if (!cluster) {
            bodyEl.innerHTML = `<div class="text-muted">Cluster not found.</div>`;
            return;
        }

        const stats = window.Store.getClusterStats(clusterId);
        const reps = window.Store.getReps();
        let nearest = null;
        if (cluster.center) {
            reps.forEach(r => {
                if (r.homeLat === null || r.homeLng === null) return;
                const d = window.Utils.haversineDistance(r.homeLat, r.homeLng, cluster.center.lat, cluster.center.lng);
                if (!nearest || d < nearest.d) nearest = { d, rep: r };
            });
        }

        const idx = (window.Store.getClusters() || []).findIndex(c => c.id === clusterId);
        const title = (idx >= 0) ? `Cluster ${idx + 1}` : `Cluster`;

        bodyEl.innerHTML = `
            <div class="inspector-row">
                <div class="inspector-k">Name</div>
                <div class="inspector-v"><span class="cluster-color-dot" style="background:${cluster.color}"></span> ${title}</div>
            </div>
            <div class="inspector-row">
                <div class="inspector-k">Houses</div>
                <div class="inspector-v">${stats ? stats.housesCount.toLocaleString() : '—'}</div>
            </div>
            <div class="inspector-row">
                <div class="inspector-k">Avg Value</div>
                <div class="inspector-v">${stats && stats.avgValue > 0 ? window.Utils.formatMoney(stats.avgValue) : '—'}</div>
            </div>
            <div class="inspector-row">
                <div class="inspector-k">Total Value</div>
                <div class="inspector-v">${stats && stats.totalValue > 0 ? window.Utils.formatMoney(stats.totalValue) : '—'}</div>
            </div>
            <div class="inspector-row">
                <div class="inspector-k">Center</div>
                <div class="inspector-v">${cluster.center ? `${cluster.center.lat.toFixed(5)}, ${cluster.center.lng.toFixed(5)}` : '—'}</div>
            </div>
            <div class="inspector-row">
                <div class="inspector-k">Nearest Rep</div>
                <div class="inspector-v">${nearest ? `${window.Utils.escapeHTML(nearest.rep.name)} <span class="text-muted">(${nearest.d.toFixed(1)} mi)</span>` : '<span class="text-muted">Add rep home bases to see distance</span>'}</div>
            </div>
            <div class="inspector-actions">
                <button class="btn btn-secondary btn-sm" id="inspectorFocus">Focus</button>
                <button class="btn btn-secondary btn-sm" id="inspectorUnselect">Clear</button>
            </div>
        `;

        // Wire actions
        const focusBtn = document.getElementById('inspectorFocus');
        if (focusBtn) {
            focusBtn.onclick = () => {
                try {
                    if (mapView && cluster.center) {
                        mapView.setCenter(cluster.center.lat, cluster.center.lng);
                        // Nudge zoom in a bit for quick inspection
                        mapView.zoomIn();
                    }
                } catch(e) {}
            };
        }
        const clearBtn = document.getElementById('inspectorUnselect');
        if (clearBtn) {
            clearBtn.onclick = () => {
                selectedClusterId = null;
                if (mapView) mapView.selectCluster(null);
                renderClusterInspector(null);
                // also clear list selection
                document.querySelectorAll('.cluster-list-item').forEach(i => i.classList.remove('selected'));
            };
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
