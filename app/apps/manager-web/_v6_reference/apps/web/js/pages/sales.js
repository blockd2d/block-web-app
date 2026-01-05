/**
 * Sales Page - List and manage sales
 */

(function() {
    'use strict';

    /**
     * Initialize sales page
     */
    function init() {
        updateKPIs();
        renderSalesTable();
        initExportButtons();

        // Listen for data changes
        window.Store.on('sales:changed', () => {
            updateKPIs();
            renderSalesTable();
        });
        window.Store.on('reps:changed', renderSalesTable);
    }

    /**
     * Initialize export buttons for sales
     */
    function initExportButtons() {
        const csvBtn = document.getElementById('exportSalesCSV');
        const jsonBtn = document.getElementById('exportSalesJSON');

        if (csvBtn) {
            csvBtn.addEventListener('click', () => {
                const csv = window.Store.exportSalesCSV();
                if (!csv || csv.split('\n').length <= 1) {
                    window.UI.toastWarning('No sales to export', 'Export');
                    return;
                }
                const ts = new Date().toISOString().slice(0, 10);
                window.Utils.downloadFile(csv, `block_sales_${ts}.csv`, 'text/csv');
                window.UI.toastSuccess('Sales CSV exported', 'Export Complete');
            });
        }

        if (jsonBtn) {
            jsonBtn.addEventListener('click', () => {
                const json = window.Store.exportSalesJSON();
                const ts = new Date().toISOString().slice(0, 10);
                window.Utils.downloadFile(json, `block_sales_${ts}.json`, 'application/json');
                window.UI.toastSuccess('Sales JSON exported', 'Export Complete');
            });
        }
    }

    /**
     * Update KPI cards
     */
    function updateKPIs() {
        const sales = window.Store.getSales();
        
        // Total Revenue
        const totalRevenue = window.Store.getTotalRevenue();
        const revenueEl = document.getElementById('kpiTotalRevenue');
        if (revenueEl) {
            revenueEl.textContent = window.Utils.formatMoney(totalRevenue);
        }

        // Average Sale Amount
        const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;
        const avgEl = document.getElementById('kpiAvgSale');
        if (avgEl) {
            avgEl.textContent = window.Utils.formatMoney(avgSale);
        }

        // Total Sales Count
        const countEl = document.getElementById('kpiTotalCount');
        if (countEl) {
            countEl.textContent = sales.length;
        }
    }

    /**
     * Render sales table
     */
    function renderSalesTable() {
        const tbodyEl = document.getElementById('salesTableBody');
        if (!tbodyEl) return;

        const sales = window.Store.getSales();
        const reps = window.Store.getReps();
        const clusters = window.Store.getClusters();

        if (sales.length === 0) {
            tbodyEl.innerHTML = `
                <tr class="empty-row">
                    <td colspan="6">
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"/>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            <span>No sales recorded yet</span>
                            <a href="add-sale.html" class="btn btn-secondary">Record Your First Sale</a>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort sales by date (newest first)
        const sortedSales = [...sales].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        tbodyEl.innerHTML = sortedSales.map(sale => {
            const rep = reps.find(r => r.id === sale.repId);
            const cluster = clusters.find(c => c.id === sale.clusterId);
            const clusterIndex = cluster ? clusters.indexOf(cluster) + 1 : null;

            return `
                <tr data-sale-id="${sale.id}">
                    <td>${window.Utils.formatDateDisplay(sale.date)}</td>
                    <td>
                        ${rep ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="cluster-color-dot" style="background-color: ${rep.color}"></span>
                                ${window.Utils.escapeHTML(rep.name)}
                            </div>
                        ` : '<span style="color: #94A3B8;">Unknown</span>'}
                    </td>
                    <td style="font-weight: 600;">${window.Utils.formatMoney(sale.amount)}</td>
                    <td>
                        ${cluster ? `
                            <span class="pill pill-info">Cluster ${clusterIndex}</span>
                        ` : '—'}
                    </td>
                    <td>
                        ${sale.notes ? `
                            <span title="${window.Utils.escapeHTML(sale.notes)}">
                                ${window.Utils.escapeHTML(sale.notes.substring(0, 50))}${sale.notes.length > 50 ? '...' : ''}
                            </span>
                        ` : '—'}
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-secondary btn-sm edit-sale-btn" data-sale-id="${sale.id}">
                                Edit
                            </button>
                            <button class="btn btn-danger btn-sm delete-sale-btn" data-sale-id="${sale.id}">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Add event handlers
        tbodyEl.querySelectorAll('.edit-sale-btn').forEach(btn => {
            btn.addEventListener('click', () => editSale(btn.dataset.saleId));
        });

        tbodyEl.querySelectorAll('.delete-sale-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteSale(btn.dataset.saleId));
        });
    }

    /**
     * Edit a sale
     * @param {string} saleId - Sale ID
     */
    async function editSale(saleId) {
        const sale = window.Store.getSale(saleId);
        if (!sale) return;

        const reps = window.Store.getReps();
        const clusters = window.Store.getClusters();

        const repOptions = reps.map(rep => {
            const selected = rep.id === sale.repId ? 'selected' : '';
            return `<option value="${rep.id}" ${selected}>${window.Utils.escapeHTML(rep.name)}</option>`;
        }).join('');

        const clusterOptions = clusters.map((cluster, index) => {
            const selected = cluster.id === sale.clusterId ? 'selected' : '';
            return `<option value="${cluster.id}" ${selected}>Cluster ${index + 1}</option>`;
        }).join('');

        const content = `
            <div class="form">
                <div class="form-group">
                    <label class="form-label" for="editSaleRep">Sales Rep</label>
                    <select id="editSaleRep" class="form-input">
                        <option value="">Select a rep...</option>
                        ${repOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="editSaleAmount">Amount ($)</label>
                    <input type="number" id="editSaleAmount" class="form-input" value="${sale.amount}" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label" for="editSaleDate">Date</label>
                    <input type="date" id="editSaleDate" class="form-input" value="${sale.date}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="editSaleCluster">Cluster (Optional)</label>
                    <select id="editSaleCluster" class="form-input">
                        <option value="">No cluster</option>
                        ${clusterOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="editSaleNotes">Notes</label>
                    <textarea id="editSaleNotes" class="form-input form-textarea" rows="3">${window.Utils.escapeHTML(sale.notes || '')}</textarea>
                </div>
            </div>
        `;

        const result = await window.UI.modal({
            title: 'Edit Sale',
            content: content,
            footer: `
                <button class="btn btn-secondary" id="modalCancel">Cancel</button>
                <button class="btn btn-primary" id="modalConfirm">Save Changes</button>
            `
        });

        if (result) {
            const repId = document.getElementById('editSaleRep').value || null;
            const amount = parseFloat(document.getElementById('editSaleAmount').value) || 0;
            const date = document.getElementById('editSaleDate').value;
            const clusterId = document.getElementById('editSaleCluster').value || null;
            const notes = document.getElementById('editSaleNotes').value.trim();

            if (!date) {
                window.UI.toastError('Date is required', 'Validation Error');
                return;
            }

            window.Store.updateSale(saleId, { repId, amount, date, clusterId, notes });
            window.UI.toastSuccess('Sale updated successfully', 'Saved');
        }
    }

    /**
     * Delete a sale
     * @param {string} saleId - Sale ID
     */
    async function deleteSale(saleId) {
        const sale = window.Store.getSale(saleId);
        if (!sale) return;

        const confirmed = await window.UI.confirm({
            title: 'Delete Sale',
            message: `Are you sure you want to delete this sale of ${window.Utils.formatMoney(sale.amount)}?`,
            confirmText: 'Delete',
            confirmClass: 'btn-danger'
        });

        if (confirmed) {
            window.Store.deleteSale(saleId);
            window.UI.toastSuccess('Sale deleted successfully', 'Deleted');
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
