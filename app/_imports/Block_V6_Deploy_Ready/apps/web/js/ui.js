/**
 * UI.js - Toast notifications, modals, and loading overlays
 */

(function(global) {
    'use strict';

    const UI = {};

    // ========================================
    // Toast Notifications
    // ========================================

    let toastContainer = null;

    function getToastContainer() {
        if (!toastContainer) {
            toastContainer = document.getElementById('toastContainer');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toastContainer';
                toastContainer.className = 'toast-container';
                document.body.appendChild(toastContainer);
            }
        }
        return toastContainer;
    }

    /**
     * Show a toast notification
     * @param {Object} options - Toast options
     * @param {string} options.title - Toast title
     * @param {string} options.message - Toast message
     * @param {string} options.type - Toast type: success, error, warning, info
     * @param {number} options.duration - Duration in ms (default 5000)
     */
    UI.toast = function(options = {}) {
        const {
            title = '',
            message = '',
            type = 'info',
            duration = 5000
        } = options;

        const container = getToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconSvg = getToastIcon(type);
        
        toast.innerHTML = `
            <div class="toast-icon">
                ${iconSvg}
            </div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${window.Utils.escapeHTML(title)}</div>` : ''}
                ${message ? `<div class="toast-message">${window.Utils.escapeHTML(message)}</div>` : ''}
            </div>
            <button class="toast-close" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toast));

        container.appendChild(toast);

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => removeToast(toast), duration);
        }

        return toast;
    };

    function removeToast(toast) {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    function getToastIcon(type) {
        switch (type) {
            case 'success':
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>`;
            case 'error':
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>`;
            case 'warning':
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>`;
            default:
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>`;
        }
    }

    // Shortcut methods
    UI.toastSuccess = function(message, title = 'Success') {
        return UI.toast({ title, message, type: 'success' });
    };

    UI.toastError = function(message, title = 'Error') {
        return UI.toast({ title, message, type: 'error' });
    };

    UI.toastWarning = function(message, title = 'Warning') {
        return UI.toast({ title, message, type: 'warning' });
    };

    UI.toastInfo = function(message, title = 'Info') {
        return UI.toast({ title, message, type: 'info' });
    };

    // ========================================
    // Modal
    // ========================================

    let modalOverlay = null;
    let modalElement = null;
    let modalResolve = null;

    function getModal() {
        if (!modalOverlay) {
            modalOverlay = document.getElementById('modalOverlay');
            modalElement = document.getElementById('modal');
            
            if (!modalOverlay) {
                modalOverlay = document.createElement('div');
                modalOverlay.id = 'modalOverlay';
                modalOverlay.className = 'modal-overlay';
                modalOverlay.innerHTML = `
                    <div class="modal" id="modal">
                        <div class="modal-header">
                            <h3 class="modal-title" id="modalTitle"></h3>
                            <button class="modal-close" id="modalClose" aria-label="Close modal">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                        <div class="modal-body" id="modalBody"></div>
                        <div class="modal-footer" id="modalFooter"></div>
                    </div>
                `;
                document.body.appendChild(modalOverlay);
                modalElement = modalOverlay.querySelector('.modal');
            }
            
            const closeBtn = modalOverlay.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => UI.closeModal(false));
            }
            
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    UI.closeModal(false);
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
                    UI.closeModal(false);
                }
            });
        }
        return { overlay: modalOverlay, modal: modalElement };
    }

    /**
     * Show a confirmation modal
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.message - Modal message
     * @param {string} options.confirmText - Confirm button text
     * @param {string} options.cancelText - Cancel button text
     * @param {string} options.confirmClass - Confirm button class
     * @returns {Promise<boolean>} Resolves true if confirmed, false otherwise
     */
    UI.confirm = function(options = {}) {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            confirmClass = 'btn-primary'
        } = options;

        return new Promise((resolve) => {
            const { overlay } = getModal();
            
            const titleEl = overlay.querySelector('#modalTitle');
            const bodyEl = overlay.querySelector('#modalBody');
            const footerEl = overlay.querySelector('#modalFooter');
            
            titleEl.textContent = title;
            bodyEl.innerHTML = `<p>${window.Utils.escapeHTML(message)}</p>`;
            footerEl.innerHTML = `
                <button class="btn btn-secondary" id="modalCancel">${window.Utils.escapeHTML(cancelText)}</button>
                <button class="btn ${confirmClass}" id="modalConfirm">${window.Utils.escapeHTML(confirmText)}</button>
            `;
            
            modalResolve = resolve;
            
            footerEl.querySelector('#modalCancel').addEventListener('click', () => UI.closeModal(false));
            footerEl.querySelector('#modalConfirm').addEventListener('click', () => UI.closeModal(true));
            
            overlay.classList.add('active');
        });
    };

    /**
     * Show a prompt modal
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.message - Modal message
     * @param {string} options.placeholder - Input placeholder
     * @param {string} options.defaultValue - Default input value
     * @param {string} options.confirmText - Confirm button text
     * @param {string} options.cancelText - Cancel button text
     * @returns {Promise<string|null>} Resolves with input value or null
     */
    UI.prompt = function(options = {}) {
        const {
            title = 'Input',
            message = '',
            placeholder = '',
            defaultValue = '',
            confirmText = 'OK',
            cancelText = 'Cancel'
        } = options;

        return new Promise((resolve) => {
            const { overlay } = getModal();
            
            const titleEl = overlay.querySelector('#modalTitle');
            const bodyEl = overlay.querySelector('#modalBody');
            const footerEl = overlay.querySelector('#modalFooter');
            
            titleEl.textContent = title;
            bodyEl.innerHTML = `
                ${message ? `<p style="margin-bottom: 1rem;">${window.Utils.escapeHTML(message)}</p>` : ''}
                <input type="text" id="modalInput" class="form-input" placeholder="${window.Utils.escapeHTML(placeholder)}" value="${window.Utils.escapeHTML(defaultValue)}">
            `;
            footerEl.innerHTML = `
                <button class="btn btn-secondary" id="modalCancel">${window.Utils.escapeHTML(cancelText)}</button>
                <button class="btn btn-primary" id="modalConfirm">${window.Utils.escapeHTML(confirmText)}</button>
            `;
            
            const input = bodyEl.querySelector('#modalInput');
            
            modalResolve = (confirmed) => {
                resolve(confirmed ? input.value : null);
            };
            
            footerEl.querySelector('#modalCancel').addEventListener('click', () => UI.closeModal(false));
            footerEl.querySelector('#modalConfirm').addEventListener('click', () => UI.closeModal(true));
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    UI.closeModal(true);
                }
            });
            
            overlay.classList.add('active');
            setTimeout(() => input.focus(), 100);
        });
    };

    /**
     * Show custom content in modal
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.content - HTML content for body
     * @param {string} options.footer - HTML content for footer (optional)
     */
    UI.modal = function(options = {}) {
        const {
            title = '',
            content = '',
            footer = ''
        } = options;

        return new Promise((resolve) => {
            const { overlay } = getModal();
            
            const titleEl = overlay.querySelector('#modalTitle');
            const bodyEl = overlay.querySelector('#modalBody');
            const footerEl = overlay.querySelector('#modalFooter');
            
            titleEl.textContent = title;
            bodyEl.innerHTML = content;
            footerEl.innerHTML = footer || `
                <button class="btn btn-primary" id="modalConfirm">OK</button>
            `;
            
            modalResolve = resolve;
            
            const confirmBtn = footerEl.querySelector('#modalConfirm');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => UI.closeModal(true));
            }

            // Optional cancel button support (many pages use a "Close" or "Cancel" button)
            const cancelBtn = footerEl.querySelector('#modalCancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => UI.closeModal(false));
            }
            
            overlay.classList.add('active');
        });
    };

    /**
     * Close the modal
     * @param {*} result - Result to resolve with
     */
    UI.closeModal = function(result) {
        const { overlay } = getModal();
        overlay.classList.remove('active');
        
        if (modalResolve) {
            modalResolve(result);
            modalResolve = null;
        }
    };

    // ========================================
    // Loading Overlay
    // ========================================

    let loadingOverlay = null;

    function getLoadingOverlay() {
        if (!loadingOverlay) {
            loadingOverlay = document.getElementById('loadingOverlay');
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'loadingOverlay';
                loadingOverlay.className = 'loading-overlay';
                loadingOverlay.innerHTML = `
                    <div class="loading-spinner"></div>
                    <span class="loading-text" id="loadingText">Loading...</span>
                `;
                document.body.appendChild(loadingOverlay);
            }
        }
        return loadingOverlay;
    }

    /**
     * Show loading overlay
     * @param {string} text - Loading text
     */
    UI.showLoading = function(text = 'Loading...') {
        const overlay = getLoadingOverlay();
        const textEl = overlay.querySelector('#loadingText') || overlay.querySelector('.loading-text');
        if (textEl) {
            textEl.textContent = text;
        }
        overlay.classList.add('active');
    };

    /**
     * Hide loading overlay
     */
    UI.hideLoading = function() {
        const overlay = getLoadingOverlay();
        overlay.classList.remove('active');
    };

    /**
     * Run an async function with loading overlay
     * @param {Function} fn - Async function to run
     * @param {string} text - Loading text
     * @returns {Promise} Result of the function
     */
    UI.withLoading = async function(fn, text = 'Loading...') {
        UI.showLoading(text);
        try {
            return await fn();
        } finally {
            UI.hideLoading();
        }
    };

    // ========================================
    // Sidebar Toggle
    // ========================================

    UI.initSidebar = function() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebarToggle');
        
        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
            
            // Close on outside click for mobile
            document.addEventListener('click', (e) => {
                if (sidebar.classList.contains('open') && 
                    !sidebar.contains(e.target) && 
                    !toggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            });
        }
    };

    

    // ========================================
    // Motion / Micro-interactions
    // ========================================

    /**
     * Adds tasteful motion: staggered page reveal, reduced-motion safe.
     */
    UI.initMotion = function() {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
            document.body.classList.add('reduce-motion');
            return;
        }

        // Page-level class to enable reveal transitions
        document.body.classList.add('motion');

        // Stagger in common UI elements
        const candidates = document.querySelectorAll(
            '.kpi-card, .card, .table-card, .form-card, .empty-state-card, .action-bar .btn, .reps-grid > *, .sales-table tbody tr'
        );

        let idx = 0;
        candidates.forEach((el) => {
            if (el.classList.contains('reveal')) return;
            el.classList.add('reveal');
            const delay = Math.min(idx, 12) * 55; // cap so big tables don't take forever
            el.style.setProperty('--delay', `${delay}ms`);
            idx++;
        });

        // Trigger in next frame
        requestAnimationFrame(() => {
            candidates.forEach(el => el.classList.add('reveal-in'));
        });
    };
// Expose to global scope
    global.UI = UI;

})(window);

// Add slideOutRight animation
(function() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(style);
})();
