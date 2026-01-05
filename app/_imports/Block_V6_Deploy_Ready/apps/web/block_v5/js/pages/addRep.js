/**
 * Add Rep Page - Form to add a new sales rep
 */

(function() {
    'use strict';

    /**
     * Initialize add rep page
     */
    function init() {
        initColorPicker();
        initForm();
    }

    /**
     * Initialize color picker
     */
    function initColorPicker() {
        const colorInput = document.getElementById('color');
        const colorPreview = document.getElementById('colorPreview');
        const randomBtn = document.getElementById('randomColorBtn');

        if (colorInput && colorPreview) {
            // Set initial random color
            const initialColor = window.Utils.randomColor();
            colorInput.value = initialColor;
            colorPreview.style.backgroundColor = initialColor;

            // Update preview on change
            colorInput.addEventListener('input', (e) => {
                colorPreview.style.backgroundColor = e.target.value;
            });
        }

        if (randomBtn && colorInput && colorPreview) {
            randomBtn.addEventListener('click', () => {
                const randomColor = window.Utils.randomColor();
                colorInput.value = randomColor;
                colorPreview.style.backgroundColor = randomColor;
            });
        }
    }

    /**
     * Initialize form submission
     */
    function initForm() {
        const form = document.getElementById('addRepForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const color = document.getElementById('color').value;
            const homeLat = (document.getElementById('homeLat') && document.getElementById('homeLat').value !== '')
                ? document.getElementById('homeLat').value
                : null;
            const homeLng = (document.getElementById('homeLng') && document.getElementById('homeLng').value !== '')
                ? document.getElementById('homeLng').value
                : null;

            // Validation
            if (!name) {
                window.UI.toastError('Please enter a name', 'Validation Error');
                return;
            }

            // Check for duplicate name
            const existingReps = window.Store.getReps();
            const duplicate = existingReps.find(r => 
                r.name.toLowerCase() === name.toLowerCase()
            );

            if (duplicate) {
                const proceed = await window.UI.confirm({
                    title: 'Duplicate Name',
                    message: `A rep named "${name}" already exists. Add anyway?`,
                    confirmText: 'Add Anyway',
                    confirmClass: 'btn-primary'
                });

                if (!proceed) return;
            }

            // Save rep
            const rep = window.Store.addRep({
                name,
                email,
                phone,
                color,
                homeLat,
                homeLng
            });

            window.UI.toastSuccess(
                `${name} has been added as a sales rep`,
                'Rep Added'
            );

            // Redirect to reps page
            setTimeout(() => {
                window.location.href = 'sales-reps.html';
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
