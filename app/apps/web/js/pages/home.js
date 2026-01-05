/**
 * Home Page - Dashboard with KPIs and rep map
 */

(function() {
    'use strict';

    let mapView = null;

    /**
     * Initialize home page
     */
    function init() {
        updateKPIs();
        initMap();

        // Listen for data changes
        window.Store.on('sales:changed', updateKPIs);
        window.Store.on('reps:changed', () => {
            updateKPIs();
            updateMap();
        });
        window.Store.on('clusters:changed', updateKPIs);
    }

    /**
     * Update KPI cards
     */
    function updateKPIs() {
        const reps = window.Store.getReps();
        const sales = window.Store.getSales();
        const clusters = window.Store.getClusters();

        // Total Revenue
        const totalRevenue = window.Store.getTotalRevenue();
        const revenueEl = document.getElementById('kpiRevenue');
        if (revenueEl) {
            revenueEl.textContent = window.Utils.formatMoney(totalRevenue);
        }

        // Avg Monthly Sales
        const avgMonthly = window.Store.getAverageMonthly();
        const avgEl = document.getElementById('kpiAvgMonthly');
        if (avgEl) {
            avgEl.textContent = window.Utils.formatMoney(avgMonthly);
        }

        // Active Reps
        const repsEl = document.getElementById('kpiReps');
        if (repsEl) {
            repsEl.textContent = reps.length;
        }

        // Clusters Created
        const clustersEl = document.getElementById('kpiClusters');
        if (clustersEl) {
            clustersEl.textContent = clusters.length;
        }
    }

    /**
     * Initialize the map
     */
    function initMap() {
        const canvas = document.getElementById('mapCanvas');
        if (!canvas) return;

        mapView = new window.MapView('mapCanvas', {
            showProperties: false,
            showClusters: false,
            showReps: true
        });

        updateMap();
    }

    /**
     * Update map with current data
     */
    function updateMap() {
        if (!mapView) return;

        const reps = window.Store.getReps();
        mapView.setReps(reps);

        // Fit to reps if there are any
        if (reps.length > 0) {
            mapView.fitToData();
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
