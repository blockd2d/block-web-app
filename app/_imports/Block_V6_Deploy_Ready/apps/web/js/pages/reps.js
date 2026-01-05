/**
 * Sales Reps Page - List and manage reps
 */

(function() {
    'use strict';

    /**
     * Initialize reps page
     */
    function init() {
        renderRepsGrid();

        // Listen for rep changes
        window.Store.on('reps:changed', renderRepsGrid);
    }

    /**
     * Render the reps grid
     */
    function renderRepsGrid() {
        const gridEl = document.getElementById('repsGrid');
        if (!gridEl) return;

        const reps = window.Store.getReps();

        if (reps.length === 0) {
            gridEl.innerHTML = `
                <div class="empty-state-card">
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <span>No sales reps added yet</span>
                        <a href="add-rep.html" class="btn btn-secondary">Add Your First Rep</a>
                    </div>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = reps.map(rep => {
            const initials = window.Utils.getInitials(rep.name);
            const stats = window.Store.getRepStats(rep.id);
            const createdDate = rep.createdAt ? window.Utils.formatDateDisplay(rep.createdAt) : 'Unknown';

            return `
                <div class="rep-card" data-rep-id="${rep.id}">
                    <div class="rep-card-header">
                        <div class="rep-avatar" style="background-color: ${rep.color}">
                            ${initials}
                        </div>
                        <div class="rep-info">
                            <div class="rep-name">${window.Utils.escapeHTML(rep.name)}</div>
                            <div class="rep-meta">Added ${createdDate}</div>
                        </div>
                    </div>
                    <div class="rep-card-body">
                        ${rep.email ? `
                            <div class="rep-detail">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                </svg>
                                <span>${window.Utils.escapeHTML(rep.email)}</span>
                            </div>
                        ` : ''}
                        ${rep.phone ? `
                            <div class="rep-detail">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                </svg>
                                <span>${window.Utils.escapeHTML(rep.phone)}</span>
                            </div>
                        ` : ''}
                        ${(rep.homeLat !== null && rep.homeLng !== null) ? `
                            <div class="rep-detail">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                <span>${rep.homeLat.toFixed(4)}, ${rep.homeLng.toFixed(4)}</span>
                            </div>
                        ` : ''}
                        <div class="rep-detail">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"/>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            <span>${stats.salesCount} sales (${window.Utils.formatMoney(stats.totalSales)})</span>
                        </div>
                        <div class="rep-detail">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <circle cx="12" cy="12" r="6"/>
                                <circle cx="12" cy="12" r="2"/>
                            </svg>
                            <span>${stats.clustersCount} clusters assigned</span>
                        </div>
                    </div>
                    <div class="rep-card-footer">
                        <button class="btn btn-primary btn-sm analytics-rep-btn" data-rep-id="${rep.id}">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                                <path d="M3 3v18h18"/>
                                <path d="M18 17V9"/>
                                <path d="M13 17V5"/>
                                <path d="M8 17v-3"/>
                            </svg>
                            Analytics
                        </button>
                        <button class="btn btn-secondary btn-sm edit-rep-btn" data-rep-id="${rep.id}">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                        </button>
                        <button class="btn btn-danger btn-sm delete-rep-btn" data-rep-id="${rep.id}">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event handlers
        gridEl.querySelectorAll('.edit-rep-btn').forEach(btn => {
            btn.addEventListener('click', () => editRep(btn.dataset.repId));
        });

        gridEl.querySelectorAll('.analytics-rep-btn').forEach(btn => {
            btn.addEventListener('click', () => showRepAnalytics(btn.dataset.repId));
        });

        gridEl.querySelectorAll('.delete-rep-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteRep(btn.dataset.repId));
        });
    }

    /**
     * Edit a rep
     * @param {string} repId - Rep ID
     */
    async function editRep(repId) {
        const rep = window.Store.getRep(repId);
        if (!rep) return;

        const content = `
            <div class="form">
                <div class="form-group">
                    <label class="form-label" for="editRepName">Full Name</label>
                    <input type="text" id="editRepName" class="form-input" value="${window.Utils.escapeHTML(rep.name)}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="editRepEmail">Email</label>
                    <input type="email" id="editRepEmail" class="form-input" value="${window.Utils.escapeHTML(rep.email || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="editRepPhone">Phone</label>
                    <input type="tel" id="editRepPhone" class="form-input" value="${window.Utils.escapeHTML(rep.phone || '')}">
                </div>
                <div class="form-divider"></div>
                <div class="form-group">
                    <label class="form-label" for="editRepHomeLat">Home Base Latitude</label>
                    <input type="number" id="editRepHomeLat" class="form-input" value="${rep.homeLat !== null && rep.homeLat !== undefined ? rep.homeLat : ''}" placeholder="39.7684" step="0.000001">
                    <span class="form-hint">Optional. Used for distance-to-cluster calculations.</span>
                </div>
                <div class="form-group">
                    <label class="form-label" for="editRepHomeLng">Home Base Longitude</label>
                    <input type="number" id="editRepHomeLng" class="form-input" value="${rep.homeLng !== null && rep.homeLng !== undefined ? rep.homeLng : ''}" placeholder="-86.1581" step="0.000001">
                </div>
                <div class="form-group">
                    <label class="form-label" for="editRepColor">Color</label>
                    <input type="color" id="editRepColor" class="form-color-input" value="${rep.color}">
                </div>
            </div>
        `;

        const result = await window.UI.modal({
            title: 'Edit Sales Rep',
            content: content,
            footer: `
                <button class="btn btn-secondary" id="modalCancel">Cancel</button>
                <button class="btn btn-primary" id="modalConfirm">Save Changes</button>
            `
        });

        if (result) {
            const name = document.getElementById('editRepName').value.trim();
            const email = document.getElementById('editRepEmail').value.trim();
            const phone = document.getElementById('editRepPhone').value.trim();
            const homeLat = document.getElementById('editRepHomeLat').value;
            const homeLng = document.getElementById('editRepHomeLng').value;
            const color = document.getElementById('editRepColor').value;

            if (!name) {
                window.UI.toastError('Name is required', 'Validation Error');
                return;
            }

            window.Store.updateRep(repId, { name, email, phone, color, homeLat, homeLng });
            window.UI.toastSuccess('Rep updated successfully', 'Saved');
        }
    }

    /**
     * Show rep analytics modal with chart and comparison vs the "average rep"
     */
    async function showRepAnalytics(repId) {
        const rep = window.Store.getRep(repId);
        if (!rep) return;

        const reps = window.Store.getReps();
        const repStats = window.Store.getRepStats(repId);

        // Average rep stats for comparison
        const avg = (function computeAverages() {
            if (!reps.length) return null;
            let sumSales = 0, sumSalesCount = 0, sumClusters = 0, sumHouses = 0, sumValue = 0;
            reps.forEach(r => {
                const s = window.Store.getRepStats(r.id);
                sumSales += s.totalSales || 0;
                sumSalesCount += s.salesCount || 0;
                sumClusters += s.clustersCount || 0;
                sumHouses += s.housesCount || 0;
                sumValue += s.estimatedValue || 0;
            });
            return {
                totalSales: sumSales / reps.length,
                salesCount: sumSalesCount / reps.length,
                clustersCount: sumClusters / reps.length,
                housesCount: sumHouses / reps.length,
                estimatedValue: sumValue / reps.length
            };
        })();

        // Build a 12-week sales time series (count + revenue)
        const series = (function buildSeries() {
            const sales = window.Store.getSalesByRep(repId);
            const today = new Date();
            const weeks = 12;
            const buckets = [];
            for (let i = weeks - 1; i >= 0; i--) {
                const start = new Date(today);
                start.setDate(start.getDate() - (i * 7));
                start.setHours(0, 0, 0, 0);
                // Week key: YYYY-Www-ish (simple)
                const key = `${start.getFullYear()}-${String(Math.floor((start - new Date(start.getFullYear(),0,1)) / (7*24*3600*1000)) + 1).padStart(2,'0')}`;
                buckets.push({ key, start, count: 0, value: 0 });
            }
            // Assign into nearest bucket by week-start
            sales.forEach(s => {
                const d = new Date(s.date);
                if (isNaN(d.getTime())) return;
                // Find bucket where d within [start, start+7)
                for (const b of buckets) {
                    const end = new Date(b.start); end.setDate(end.getDate() + 7);
                    if (d >= b.start && d < end) {
                        b.count += 1;
                        b.value += (Number(s.amount) || 0);
                        break;
                    }
                }
            });
            return buckets;
        })();

        // Distance stats (if rep has coords)
        const dist = (function computeDistanceStats() {
            if (!(rep.homeLat !== null && rep.homeLng !== null)) return null;
            const assigns = window.Store.getAssignmentsByRep(repId);
            const clusters = assigns.map(a => window.Store.getCluster(a.clusterId)).filter(Boolean);
            const miles = [];
            clusters.forEach(c => {
                if (!c.center) return;
                miles.push(window.Utils.haversineDistance(rep.homeLat, rep.homeLng, c.center.lat, c.center.lng));
            });
            if (!miles.length) return { avg: 0, max: 0, n: 0 };
            const sum = miles.reduce((a, b) => a + b, 0);
            return { avg: sum / miles.length, max: Math.max(...miles), n: miles.length };
        })();

        const content = `
            <div class="rep-analytics">
                <div class="rep-analytics-header">
                    <div class="rep-analytics-avatar" style="background-color: ${rep.color}">${window.Utils.getInitials(rep.name)}</div>
                    <div>
                        <div class="rep-analytics-name">${window.Utils.escapeHTML(rep.name)}</div>
                        <div class="rep-analytics-sub">${(rep.homeLat !== null && rep.homeLng !== null) ? `${rep.homeLat.toFixed(4)}, ${rep.homeLng.toFixed(4)}` : 'No home base set'}</div>
                    </div>
                </div>

                <div class="rep-analytics-grid">
                    <div class="metric">
                        <div class="metric-label">Total Sales</div>
                        <div class="metric-value">${window.Utils.formatMoney(repStats.totalSales)}</div>
                        <div class="metric-sub">Avg rep: ${avg ? window.Utils.formatMoney(avg.totalSales) : '—'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Sales Count</div>
                        <div class="metric-value">${repStats.salesCount}</div>
                        <div class="metric-sub">Avg rep: ${avg ? avg.salesCount.toFixed(1) : '—'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Clusters Assigned</div>
                        <div class="metric-value">${repStats.clustersCount}</div>
                        <div class="metric-sub">Avg rep: ${avg ? avg.clustersCount.toFixed(1) : '—'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Territory Houses</div>
                        <div class="metric-value">${repStats.housesCount.toLocaleString()}</div>
                        <div class="metric-sub">Avg rep: ${avg ? avg.housesCount.toFixed(0) : '—'}</div>
                    </div>
                </div>

                <div class="form-divider"></div>

                <div class="rep-analytics-chart">
                    <div class="chart-title">Sales (last 12 weeks)</div>
                    <canvas id="repChart" width="520" height="140"></canvas>
                    <div class="chart-legend">
                        <span class="pill pill-info">Line = Revenue</span>
                        <span class="pill pill-secondary">Bars = Count</span>
                    </div>
                </div>

                ${dist ? `
                    <div class="rep-analytics-dist">
                        <div class="metric">
                            <div class="metric-label">Avg Cluster Distance</div>
                            <div class="metric-value">${dist.avg.toFixed(1)} mi</div>
                            <div class="metric-sub">Based on ${dist.n} assigned cluster center${dist.n === 1 ? '' : 's'}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Farthest Cluster</div>
                            <div class="metric-value">${dist.max.toFixed(1)} mi</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Open modal (do NOT await before drawing: the modal promise resolves on close)
        const modalPromise = window.UI.modal({
            title: 'Rep Analytics',
            content,
            footer: `
                <button class="btn btn-secondary" id="modalCancel">Close</button>
            `
        });

        // Draw chart after modal DOM mounts
        // Use rAF to ensure elements exist + have layout
        try {
            requestAnimationFrame(() => {
                const canvas = document.getElementById('repChart');
                if (canvas) {
                    drawRepChart(canvas, series, rep.color);
                }
            });
        } catch (e) {
            console.warn('Chart render skipped:', e.message);
        }

        // Await close
        await modalPromise;
    }

    function drawRepChart(canvas, series, color) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        const pad = 18;
        const innerW = w - pad * 2;
        const innerH = h - pad * 2;

        const maxValue = Math.max(1, ...series.map(s => s.value));
        const maxCount = Math.max(1, ...series.map(s => s.count));

        // Background
        ctx.fillStyle = 'rgba(148,163,184,0.05)';
        ctx.fillRect(0, 0, w, h);

        // Bars (count)
        const barW = innerW / series.length;
        series.forEach((s, i) => {
            const x = pad + i * barW + 2;
            const bh = (s.count / maxCount) * (innerH * 0.6);
            const y = pad + innerH - bh;
            ctx.fillStyle = 'rgba(148,163,184,0.25)';
            ctx.fillRect(x, y, Math.max(2, barW - 4), bh);
        });

        // Revenue line
        ctx.strokeStyle = color || '#7C3AED';
        ctx.lineWidth = 2;
        ctx.beginPath();
        series.forEach((s, i) => {
            const x = pad + i * barW + barW / 2;
            const y = pad + innerH - (s.value / maxValue) * innerH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Points
        ctx.fillStyle = color || '#7C3AED';
        series.forEach((s, i) => {
            const x = pad + i * barW + barW / 2;
            const y = pad + innerH - (s.value / maxValue) * innerH;
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Axes (subtle)
        ctx.strokeStyle = 'rgba(148,163,184,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, pad + innerH);
        ctx.lineTo(pad + innerW, pad + innerH);
        ctx.stroke();
    }

    /**
     * Delete a rep
     * @param {string} repId - Rep ID
     */
    async function deleteRep(repId) {
        const rep = window.Store.getRep(repId);
        if (!rep) return;

        const confirmed = await window.UI.confirm({
            title: 'Delete Sales Rep',
            message: `Are you sure you want to delete ${rep.name}? This will also delete their sales records and cluster assignments.`,
            confirmText: 'Delete',
            confirmClass: 'btn-danger'
        });

        if (confirmed) {
            window.Store.deleteRep(repId);
            window.UI.toastSuccess('Rep deleted successfully', 'Deleted');
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
