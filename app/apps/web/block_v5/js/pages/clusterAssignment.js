/**
 * Cluster Assignment Page - Assign clusters to reps and export
 */

(function() {
    'use strict';

    /**
     * Initialize cluster assignment page
     */
    function init() {
        updateRepSummary();
        updateClusterTable();
        initExportButtons();

        // Listen for data changes
        window.Store.on('clusters:changed', () => {
            updateClusterTable();
            updateRepSummary();
        });
        window.Store.on('reps:changed', () => {
            updateClusterTable();
            updateRepSummary();
        });
        window.Store.on('assignments:changed', updateRepSummary);
    }

    /**
     * Update rep summary cards
     */
    function updateRepSummary() {
        const gridEl = document.getElementById('repSummaryGrid');
        if (!gridEl) return;

        const reps = window.Store.getReps();

        if (reps.length === 0) {
            gridEl.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span>No reps added yet. <a href="add-rep.html">Add a rep</a></span>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = reps.map(rep => {
            const stats = window.Store.getRepStats(rep.id);
            const initials = window.Utils.getInitials(rep.name);

            return `
                <div class="rep-summary-card">
                    <div class="rep-summary-header">
                        <div class="rep-summary-avatar" style="background-color: ${rep.color}">
                            ${initials}
                        </div>
                        <div class="rep-summary-name">${window.Utils.escapeHTML(rep.name)}</div>
                    </div>
                    <div class="rep-summary-stats">
                        <div class="rep-summary-stat">
                            <span class="rep-summary-stat-label">Clusters</span>
                            <span class="rep-summary-stat-value">${stats.clustersCount}</span>
                        </div>
                        <div class="rep-summary-stat">
                            <span class="rep-summary-stat-label">Houses</span>
                            <span class="rep-summary-stat-value">${stats.housesCount.toLocaleString()}</span>
                        </div>
                        <div class="rep-summary-stat">
                            <span class="rep-summary-stat-label">Value</span>
                            <span class="rep-summary-stat-value">${window.Utils.formatMoney(stats.estimatedValue)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Update cluster assignment table
     */
    function updateClusterTable() {
        const tbodyEl = document.getElementById('clusterTableBody');
        const countEl = document.getElementById('totalClusterCount');
        if (!tbodyEl) return;

        const clusters = window.Store.getClusters();
        const reps = window.Store.getReps();

        if (countEl) {
            countEl.textContent = `${clusters.length} cluster${clusters.length !== 1 ? 's' : ''}`;
        }

        if (clusters.length === 0) {
            tbodyEl.innerHTML = `
                <tr class="empty-row">
                    <td colspan="7">
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <circle cx="12" cy="12" r="6"/>
                                <circle cx="12" cy="12" r="2"/>
                            </svg>
                            <span>No clusters created. <a href="cluster-creation.html">Create clusters</a></span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbodyEl.innerHTML = clusters.map((cluster, index) => {
            const stats = window.Store.getClusterStats(cluster.id);
            const assignment = window.Store.getAssignment(cluster.id);
            const assignedRepId = assignment ? assignment.repId : '';

            // Distance cell: if assigned, compute from rep home base; otherwise show nearest rep
            let distanceCell = '—';
            if (cluster.center) {
                if (assignedRepId) {
                    const rep = window.Store.getRep(assignedRepId);
                    if (rep && rep.homeLat !== null && rep.homeLng !== null) {
                        const d = window.Utils.haversineDistance(rep.homeLat, rep.homeLng, cluster.center.lat, cluster.center.lng);
                        distanceCell = `${d.toFixed(1)} mi`;
                    }
                } else {
                    let best = null;
                    reps.forEach(r => {
                        if (r.homeLat === null || r.homeLng === null) return;
                        const d = window.Utils.haversineDistance(r.homeLat, r.homeLng, cluster.center.lat, cluster.center.lng);
                        if (!best || d < best.d) best = { d, name: r.name };
                    });
                    if (best) {
                        distanceCell = `${best.d.toFixed(1)} mi <span class="text-muted">→ ${window.Utils.escapeHTML(best.name)}</span>`;
                    }
                }
            }

            // Build rep dropdown options
            const repOptions = reps.map(rep => {
                const selected = rep.id === assignedRepId ? 'selected' : '';
                return `<option value="${rep.id}" ${selected}>${window.Utils.escapeHTML(rep.name)}</option>`;
            }).join('');

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="cluster-color-dot" style="background-color: ${cluster.color}"></span>
                            <span>Cluster ${index + 1}</span>
                        </div>
                    </td>
                    <td>${stats ? stats.housesCount.toLocaleString() : 0}</td>
                    <td>${stats && stats.totalValue > 0 ? window.Utils.formatMoney(stats.totalValue) : '—'}</td>
                    <td>${stats && stats.avgValue > 0 ? window.Utils.formatMoney(stats.avgValue) : '—'}</td>
                    <td>
                        ${cluster.center ? `${cluster.center.lat.toFixed(4)}, ${cluster.center.lng.toFixed(4)}` : '—'}
                    </td>
                    <td>${distanceCell}</td>
                    <td>
                        <select class="form-input rep-select" data-cluster-id="${cluster.id}" style="min-width: 150px;">
                            <option value="">Unassigned</option>
                            ${repOptions}
                        </select>
                    </td>
                </tr>
            `;
        }).join('');

        // Add change handlers for rep dropdowns
        tbodyEl.querySelectorAll('.rep-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const clusterId = e.target.dataset.clusterId;
                const repId = e.target.value || null;
                
                window.Store.setAssignment(clusterId, repId);
                updateRepSummary();
                
                window.UI.toastSuccess('Assignment updated', 'Saved');
            });
        });
    }

    /**
     * Initialize export buttons
     */
    function initExportButtons() {
        const jsonBtn = document.getElementById('exportJSON');
        const csvBtn = document.getElementById('exportCSV');

        if (jsonBtn) {
            jsonBtn.addEventListener('click', exportJSON);
        }

        if (csvBtn) {
            csvBtn.addEventListener('click', exportCSV);
        }
    }

    /**
     * Export clusters and assignments as JSON
     */
    function exportJSON() {
        const clusters = window.Store.getClusters();
        
        if (clusters.length === 0) {
            window.UI.toastWarning('No clusters to export', 'Export');
            return;
        }

        const json = window.Store.exportJSON();
        const filename = `clusters-export-${window.Utils.formatDate(new Date())}.json`;
        
        window.Utils.downloadFile(json, filename, 'application/json');
        window.UI.toastSuccess('JSON exported successfully', 'Export Complete');
    }

    /**
     * Export clusters and assignments as CSV
     */
    function exportCSV() {
        const clusters = window.Store.getClusters();
        
        if (clusters.length === 0) {
            window.UI.toastWarning('No clusters to export', 'Export');
            return;
        }

        const csv = window.Store.exportCSV();
        const filename = `clusters-export-${window.Utils.formatDate(new Date())}.csv`;
        
        window.Utils.downloadFile(csv, filename, 'text/csv');
        window.UI.toastSuccess('CSV exported successfully', 'Export Complete');
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
