/**
 * Store.js - Data persistence layer using LocalStorage
 */

(function(global) {
    'use strict';

    // Configuration
    const APP_CONFIG = {
        STORAGE_KEY: 'salesRepManager.v1',
        VERSION: 1
    };

    // Define cluster colors palette FIRST to avoid TDZ
    const CLUSTER_COLORS = [
        '#4F46E5', '#7C3AED', '#DB2777', '#DC2626',
        '#EA580C', '#D97706', '#65A30D', '#059669',
        '#0891B2', '#0284C7', '#2563EB', '#4338CA',
        '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
        '#F97316', '#EAB308', '#84CC16', '#22C55E',
        '#14B8A6', '#06B6D4', '#3B82F6', '#6D28D9'
    ];

    /**
     * Get default data structure
     * @returns {Object} Default data
     */
    function getDefaultData() {
        // Seed demo data (requested): 3 reps with home base coordinates + a bit of sales history.
        // This only applies on first run when no localStorage data exists.
        const today = new Date();
        const isoDay = (d) => d.toISOString().split('T')[0];
        const daysAgo = (n) => {
            const d = new Date(today);
            d.setDate(d.getDate() - n);
            return isoDay(d);
        };

        const repsSeed = [
            {
                id: 'rep_aaron_means',
                name: 'Aaron Means',
                color: '#4F46E5',
                phone: '',
                email: '',
                // Avon, IN (approx)
                homeLat: 39.7620,
                homeLng: -86.3990,
                createdAt: today.toISOString()
            },
            {
                id: 'rep_stephen_onochie',
                name: 'Stephen Onochie',
                color: '#22C55E',
                phone: '',
                email: '',
                // Brownsburg, IN (approx)
                homeLat: 39.8430,
                homeLng: -86.3970,
                createdAt: today.toISOString()
            },
            {
                id: 'rep_jamison_blair',
                name: 'Jamison Blair',
                color: '#EC4899',
                phone: '',
                email: '',
                // Downtown Indianapolis, IN (approx)
                homeLat: 39.7684,
                homeLng: -86.1581,
                createdAt: today.toISOString()
            }
        ];

        const salesSeed = [
            { id: 'sale_seed_01', repId: 'rep_aaron_means', amount: 340, date: daysAgo(6),  notes: 'Driveway + walkway', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_02', repId: 'rep_stephen_onochie', amount: 280, date: daysAgo(9),  notes: 'Vinyl siding wash', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_03', repId: 'rep_jamison_blair', amount: 420, date: daysAgo(13), notes: '2-story exterior', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_04', repId: 'rep_aaron_means', amount: 210, date: daysAgo(18), notes: 'Small patio clean', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_05', repId: 'rep_stephen_onochie', amount: 510, date: daysAgo(22), notes: 'Full house + deck', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_06', repId: 'rep_jamison_blair', amount: 295, date: daysAgo(27), notes: 'Fence wash', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_07', repId: 'rep_aaron_means', amount: 365, date: daysAgo(33), notes: 'Concrete + steps', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_08', repId: 'rep_stephen_onochie', amount: 255, date: daysAgo(41), notes: 'Gutter brightening', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_09', repId: 'rep_jamison_blair', amount: 600, date: daysAgo(55), notes: 'Commercial storefront', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_10', repId: 'rep_aaron_means', amount: 315, date: daysAgo(63), notes: 'House wash', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_11', repId: 'rep_stephen_onochie', amount: 190, date: daysAgo(71), notes: 'Spot clean', clusterId: null, createdAt: today.toISOString() },
            { id: 'sale_seed_12', repId: 'rep_jamison_blair', amount: 475, date: daysAgo(84), notes: 'Driveway + siding', clusterId: null, createdAt: today.toISOString() }
        ];

        return {
            meta: {
                version: APP_CONFIG.VERSION,
                updatedAt: new Date().toISOString()
            },
            reps: repsSeed,
            sales: salesSeed,
            properties: [],
            clusters: [],
            assignments: []
        };
    }

    /**
     * Store class for managing app data
     */
    class Store {
        constructor() {
            this.data = null;
            this.listeners = new Map();
            this.load();
        }

        /**
         * Load data from localStorage
         */
        load() {
            try {
                const stored = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    this.data = this.migrate(parsed);
                } else {
                    this.data = getDefaultData();
                }
            } catch (err) {
                console.error('Failed to load store:', err);
                this.data = getDefaultData();
            }
        }

        /**
         * Migrate data to latest version
         * @param {Object} data - Data to migrate
         * @returns {Object} Migrated data
         */
        migrate(data) {
            // Ensure all required fields exist
            const migrated = {
                meta: data.meta || { version: 1, updatedAt: new Date().toISOString() },
                reps: (data.reps || []).map(r => {
                    // Add missing fields in a backwards-compatible way
                    const homeLat = (r.homeLat !== undefined && r.homeLat !== null && r.homeLat !== '') ? parseFloat(r.homeLat) : null;
                    const homeLng = (r.homeLng !== undefined && r.homeLng !== null && r.homeLng !== '') ? parseFloat(r.homeLng) : null;
                    return {
                        ...r,
                        homeLat: Number.isFinite(homeLat) ? homeLat : null,
                        homeLng: Number.isFinite(homeLng) ? homeLng : null
                    };
                }),
                sales: data.sales || [],
                properties: data.properties || [],
                clusters: data.clusters || [],
                assignments: data.assignments || []
            };

            // Future migrations can be added here
            migrated.meta.version = APP_CONFIG.VERSION;
            
            return migrated;
        }

        /**
         * Save data to localStorage
         */
        save() {
            try {
                this.data.meta.updatedAt = new Date().toISOString();
                localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(this.data));
                this.emit('save', this.data);
            } catch (err) {
                console.error('Failed to save store:', err);
            }
        }

        /**
         * Subscribe to store events
         * @param {string} event - Event name
         * @param {Function} callback - Callback function
         * @returns {Function} Unsubscribe function
         */
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(callback);
            return () => this.listeners.get(event).delete(callback);
        }

        /**
         * Emit an event
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        emit(event, data) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).forEach(cb => {
                    try {
                        cb(data);
                    } catch (err) {
                        console.error('Event listener error:', err);
                    }
                });
            }
        }

        // ========================================
        // Reps CRUD
        // ========================================

        getReps() {
            return this.data.reps || [];
        }

        getRep(id) {
            return this.data.reps.find(r => r.id === id);
        }

        addRep(rep) {
            const newRep = {
                id: window.Utils.uid('rep'),
                name: rep.name || 'Unknown',
                color: rep.color || window.Utils.randomColor(),
                phone: rep.phone || '',
                email: rep.email || '',
                homeLat: Number.isFinite(parseFloat(rep.homeLat)) ? parseFloat(rep.homeLat) : null,
                homeLng: Number.isFinite(parseFloat(rep.homeLng)) ? parseFloat(rep.homeLng) : null,
                createdAt: new Date().toISOString()
            };
            this.data.reps.push(newRep);
            this.save();
            this.emit('reps:changed', this.data.reps);
            return newRep;
        }

        updateRep(id, updates) {
            const idx = this.data.reps.findIndex(r => r.id === id);
            if (idx === -1) return null;
            
            // Normalize numeric fields
            if (updates.homeLat !== undefined) {
                const v = (updates.homeLat === '' || updates.homeLat === null) ? null : parseFloat(updates.homeLat);
                updates.homeLat = Number.isFinite(v) ? v : null;
            }
            if (updates.homeLng !== undefined) {
                const v = (updates.homeLng === '' || updates.homeLng === null) ? null : parseFloat(updates.homeLng);
                updates.homeLng = Number.isFinite(v) ? v : null;
            }

            this.data.reps[idx] = { ...this.data.reps[idx], ...updates };
            this.save();
            this.emit('reps:changed', this.data.reps);
            return this.data.reps[idx];
        }

        deleteRep(id) {
            const idx = this.data.reps.findIndex(r => r.id === id);
            if (idx === -1) return false;
            
            this.data.reps.splice(idx, 1);
            // Also remove related sales
            this.data.sales = this.data.sales.filter(s => s.repId !== id);
            // Also remove related assignments
            this.data.assignments = this.data.assignments.filter(a => a.repId !== id);
            this.save();
            this.emit('reps:changed', this.data.reps);
            return true;
        }

        // ========================================
        // Sales CRUD
        // ========================================

        getSales() {
            return this.data.sales || [];
        }

        getSale(id) {
            return this.data.sales.find(s => s.id === id);
        }

        addSale(sale) {
            const newSale = {
                id: window.Utils.uid('sale'),
                repId: sale.repId || null,
                amount: parseFloat(sale.amount) || 0,
                date: sale.date || new Date().toISOString().split('T')[0],
                notes: sale.notes || '',
                clusterId: sale.clusterId || null,
                createdAt: new Date().toISOString()
            };
            this.data.sales.push(newSale);
            this.save();
            this.emit('sales:changed', this.data.sales);
            return newSale;
        }

        updateSale(id, updates) {
            const idx = this.data.sales.findIndex(s => s.id === id);
            if (idx === -1) return null;
            
            if (updates.amount !== undefined) {
                updates.amount = parseFloat(updates.amount) || 0;
            }
            
            this.data.sales[idx] = { ...this.data.sales[idx], ...updates };
            this.save();
            this.emit('sales:changed', this.data.sales);
            return this.data.sales[idx];
        }

        deleteSale(id) {
            const idx = this.data.sales.findIndex(s => s.id === id);
            if (idx === -1) return false;
            
            this.data.sales.splice(idx, 1);
            this.save();
            this.emit('sales:changed', this.data.sales);
            return true;
        }

        getSalesByRep(repId) {
            return this.data.sales.filter(s => s.repId === repId);
        }

        getTotalRevenue() {
            return this.data.sales.reduce((sum, s) => sum + (s.amount || 0), 0);
        }

        getAverageMonthly() {
            const sales = this.data.sales;
            if (sales.length === 0) return 0;
            
            // Group by month
            const byMonth = {};
            sales.forEach(s => {
                const month = s.date ? s.date.substring(0, 7) : 'unknown';
                byMonth[month] = (byMonth[month] || 0) + (s.amount || 0);
            });
            
            const months = Object.keys(byMonth);
            if (months.length === 0) return 0;
            
            const total = Object.values(byMonth).reduce((a, b) => a + b, 0);
            return total / months.length;
        }

        // ========================================
        // Properties CRUD
        // ========================================

        getProperties() {
            return this.data.properties || [];
        }

        setProperties(properties) {
            this.data.properties = properties;
            this.save();
            this.emit('properties:changed', this.data.properties);
        }

        clearProperties() {
            this.data.properties = [];
            this.data.clusters = [];
            this.data.assignments = [];
            this.save();
            this.emit('properties:changed', this.data.properties);
            this.emit('clusters:changed', this.data.clusters);
        }

        hasPrice() {
            const props = this.data.properties;
            if (!props || props.length === 0) return false;
            return props.some(p => p.price !== null && p.price !== undefined && !isNaN(p.price));
        }

        // ========================================
        // Clusters CRUD
        // ========================================

        getClusters() {
            return this.data.clusters || [];
        }

        getCluster(id) {
            return this.data.clusters.find(c => c.id === id);
        }

        setClusters(clusters) {
            // Assign stable colors from palette
            clusters.forEach((cluster, idx) => {
                cluster.color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
            });
            this.data.clusters = clusters;
            this.save();
            this.emit('clusters:changed', this.data.clusters);
        }

        clearClusters() {
            this.data.clusters = [];
            this.data.assignments = [];
            this.save();
            this.emit('clusters:changed', this.data.clusters);
            this.emit('assignments:changed', this.data.assignments);
        }

        getClusterColor(index) {
            return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
        }

        // ========================================
        // Assignments CRUD
        // ========================================

        getAssignments() {
            return this.data.assignments || [];
        }

        getAssignment(clusterId) {
            return this.data.assignments.find(a => a.clusterId === clusterId);
        }

        setAssignment(clusterId, repId) {
            const existing = this.data.assignments.findIndex(a => a.clusterId === clusterId);
            
            if (repId) {
                const assignment = {
                    clusterId,
                    repId,
                    assignedAt: new Date().toISOString()
                };
                
                if (existing >= 0) {
                    this.data.assignments[existing] = assignment;
                } else {
                    this.data.assignments.push(assignment);
                }
            } else {
                // Remove assignment if repId is null
                if (existing >= 0) {
                    this.data.assignments.splice(existing, 1);
                }
            }
            
            this.save();
            this.emit('assignments:changed', this.data.assignments);
        }

        getAssignmentsByRep(repId) {
            return this.data.assignments.filter(a => a.repId === repId);
        }

        // ========================================
        // Stats & Aggregations
        // ========================================

        getRepStats(repId) {
            const sales = this.getSalesByRep(repId);
            const assignments = this.getAssignmentsByRep(repId);
            const clusters = this.data.clusters.filter(c => 
                assignments.some(a => a.clusterId === c.id)
            );
            
            let totalHouses = 0;
            let totalValue = 0;
            
            clusters.forEach(cluster => {
                totalHouses += cluster.memberPropertyIds ? cluster.memberPropertyIds.length : 0;
                
                // Calculate value from properties if price available
                if (cluster.memberPropertyIds && this.hasPrice()) {
                    cluster.memberPropertyIds.forEach(propId => {
                        const prop = this.data.properties.find(p => p.id === propId);
                        if (prop && prop.price) {
                            totalValue += prop.price;
                        }
                    });
                }
            });
            
            return {
                clustersCount: clusters.length,
                housesCount: totalHouses,
                estimatedValue: totalValue,
                salesCount: sales.length,
                totalSales: sales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
            };
        }

        getClusterStats(clusterId) {
            const cluster = this.getCluster(clusterId);
            if (!cluster) return null;
            
            const memberIds = cluster.memberPropertyIds || [];
            let totalValue = 0;
            let priceCount = 0;
            
            memberIds.forEach(propId => {
                const prop = this.data.properties.find(p => p.id === propId);
                if (prop && prop.price !== null && prop.price !== undefined && !isNaN(prop.price)) {
                    totalValue += prop.price;
                    priceCount++;
                }
            });
            
            return {
                housesCount: memberIds.length,
                totalValue: totalValue,
                avgValue: priceCount > 0 ? totalValue / priceCount : 0
            };
        }

        /**
         * Export clusters and assignments as JSON
         * @returns {string} JSON string
         */
        exportJSON() {
            const exportData = {
                exportedAt: new Date().toISOString(),
                clusters: this.data.clusters.map(cluster => {
                    const assignment = this.getAssignment(cluster.id);
                    const rep = assignment ? this.getRep(assignment.repId) : null;
                    const stats = this.getClusterStats(cluster.id);
                    
                    return {
                        id: cluster.id,
                        center: cluster.center,
                        hull: cluster.hull,
                        housesCount: stats ? stats.housesCount : 0,
                        totalValue: stats ? stats.totalValue : 0,
                        avgValue: stats ? stats.avgValue : 0,
                        assignedRep: rep ? { id: rep.id, name: rep.name } : null
                    };
                }),
                reps: this.data.reps.map(rep => ({
                    id: rep.id,
                    name: rep.name,
                    email: rep.email,
                    phone: rep.phone,
                    homeLat: rep.homeLat,
                    homeLng: rep.homeLng
                }))
            };
            
            return JSON.stringify(exportData, null, 2);
        }

        /**
         * Export clusters and assignments as CSV
         * @returns {string} CSV string
         */
        exportCSV() {
            const rows = [
                ['clusterId', 'repId', 'repName', 'centerLat', 'centerLng', 'houses', 'totalValue', 'avgValue']
            ];
            
            this.data.clusters.forEach(cluster => {
                const assignment = this.getAssignment(cluster.id);
                const rep = assignment ? this.getRep(assignment.repId) : null;
                const stats = this.getClusterStats(cluster.id);
                
                rows.push([
                    cluster.id,
                    rep ? rep.id : '',
                    rep ? `"${rep.name}"` : '',
                    cluster.center ? cluster.center.lat.toFixed(6) : '',
                    cluster.center ? cluster.center.lng.toFixed(6) : '',
                    stats ? stats.housesCount : 0,
                    stats ? stats.totalValue.toFixed(2) : 0,
                    stats ? stats.avgValue.toFixed(2) : 0
                ]);
            });
            
            return rows.map(r => r.join(',')).join('\n');
        }

        /**
         * Export sales as JSON
         * @returns {string} JSON string
         */
        exportSalesJSON() {
            const repsById = new Map(this.data.reps.map(r => [r.id, r]));
            const clustersById = new Map(this.data.clusters.map(c => [c.id, c]));

            const payload = {
                exportedAt: new Date().toISOString(),
                sales: (this.data.sales || []).map(s => {
                    const rep = s.repId ? repsById.get(s.repId) : null;
                    const cluster = s.clusterId ? clustersById.get(s.clusterId) : null;
                    return {
                        id: s.id,
                        date: s.date,
                        amount: s.amount,
                        notes: s.notes || '',
                        rep: rep ? { id: rep.id, name: rep.name, email: rep.email, phone: rep.phone } : null,
                        cluster: cluster ? { id: cluster.id, center: cluster.center } : null
                    };
                })
            };

            return JSON.stringify(payload, null, 2);
        }

        /**
         * Export sales as CSV
         * @returns {string} CSV string
         */
        exportSalesCSV() {
            const rows = [
                ['saleId', 'date', 'repId', 'repName', 'amount', 'clusterId', 'notes']
            ];

            const repsById = new Map(this.data.reps.map(r => [r.id, r]));
            (this.data.sales || []).forEach(s => {
                const rep = s.repId ? repsById.get(s.repId) : null;
                const safeNotes = (s.notes || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
                // Quote fields that may contain commas
                const repName = rep ? `"${String(rep.name).replace(/"/g, '""')}"` : '';
                const notes = safeNotes ? `"${safeNotes.replace(/"/g, '""')}"` : '';
                rows.push([
                    s.id,
                    s.date || '',
                    rep ? rep.id : '',
                    repName,
                    Number.isFinite(+s.amount) ? (+s.amount).toFixed(2) : '0.00',
                    s.clusterId || '',
                    notes
                ]);
            });

            return rows.map(r => r.join(',')).join('\n');
        }
    }

    // Create singleton instance
    const store = new Store();

    // Expose to global scope
    global.Store = store;
    global.APP_CONFIG = APP_CONFIG;

})(window);
