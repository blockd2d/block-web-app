/**
 * Add Sale Page - Form to record a new sale
 */

(function() {
    'use strict';

    /**
     * Initialize add sale page
     */
    function init() {
        populateDropdowns();
        setDefaultDate();
        initForm();
    }

    /**
     * Populate rep and cluster dropdowns
     */
    function populateDropdowns() {
        const repSelect = document.getElementById('repId');
        const clusterSelect = document.getElementById('clusterId');

        if (repSelect) {
            const reps = window.Store.getReps();
            repSelect.innerHTML = '<option value="">Select a rep...</option>' +
                reps.map(rep => `
                    <option value="${rep.id}">${window.Utils.escapeHTML(rep.name)}</option>
                `).join('');
        }

        if (clusterSelect) {
            const clusters = window.Store.getClusters();
            clusterSelect.innerHTML = '<option value="">No cluster</option>' +
                clusters.map((cluster, index) => `
                    <option value="${cluster.id}">Cluster ${index + 1} (${cluster.memberPropertyIds ? cluster.memberPropertyIds.length : 0} houses)</option>
                `).join('');
        }
    }

    /**
     * Set default date to today
     */
    function setDefaultDate() {
        const dateInput = document.getElementById('date');
        if (dateInput && !dateInput.value) {
            dateInput.value = window.Utils.formatDate(new Date());
        }
    }

    /**
     * Initialize form submission
     */
    function initForm() {
        const form = document.getElementById('addSaleForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const repId = document.getElementById('repId').value || null;
            const amount = parseFloat(document.getElementById('amount').value) || 0;
            const date = document.getElementById('date').value;
            const clusterId = document.getElementById('clusterId').value || null;
            const notes = document.getElementById('notes').value.trim();

            // Validation
            if (!repId) {
                window.UI.toastError('Please select a sales rep', 'Validation Error');
                return;
            }

            if (amount <= 0) {
                window.UI.toastError('Please enter a valid amount', 'Validation Error');
                return;
            }

            if (!date) {
                window.UI.toastError('Please select a date', 'Validation Error');
                return;
            }

            // Save sale
            const sale = window.Store.addSale({
                repId,
                amount,
                date,
                clusterId,
                notes
            });

            window.UI.toastSuccess(
                `Sale of ${window.Utils.formatMoney(amount)} recorded`,
                'Sale Added'
            );

            // Redirect to sales page
            setTimeout(() => {
                window.location.href = 'sales.html';
            }, 500);
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
