/**
 * DBSCAN.js - Density-Based Spatial Clustering with grid-based spatial index
 * Implements DBSCAN with haversine distance and O(n log n) neighbor search
 */

(function(global) {
    'use strict';

    const DBSCAN = {};

    // Earth radius in miles
    const EARTH_RADIUS_MILES = 3958.8;

    /**
     * Run DBSCAN clustering on points
     * @param {Array} points - Array of { id, lat, lng } objects
     * @param {number} epsMiles - Neighborhood radius in miles
     * @param {number} minPts - Minimum points to form a cluster
     * @param {Function} onProgress - Progress callback (optional)
     * @returns {Array} Array of cluster objects with memberPropertyIds
     */
    DBSCAN.cluster = function(points, epsMiles, minPts, onProgress = null) {
        if (!points || points.length === 0) {
            return [];
        }

        // Build spatial index
        const index = buildSpatialIndex(points, epsMiles);
        
        // Labels: -1 = noise, 0+ = cluster id
        const labels = new Array(points.length).fill(-2); // -2 = undefined
        let clusterId = 0;

        // Process each point
        for (let i = 0; i < points.length; i++) {
            if (labels[i] !== -2) continue; // Already processed

            // Find neighbors using spatial index
            const neighbors = rangeQuery(points, i, index, epsMiles);

            if (neighbors.length < minPts) {
                labels[i] = -1; // Mark as noise
            } else {
                // Start new cluster
                expandCluster(points, labels, i, neighbors, clusterId, epsMiles, minPts, index);
                clusterId++;
            }

            // Report progress
            if (onProgress && i % 1000 === 0) {
                onProgress(i / points.length);
            }
        }

        // Build cluster objects
        const clusters = [];
        for (let c = 0; c < clusterId; c++) {
            const memberIndices = [];
            for (let i = 0; i < labels.length; i++) {
                if (labels[i] === c) {
                    memberIndices.push(i);
                }
            }

            if (memberIndices.length >= minPts) {
                const memberPoints = memberIndices.map(i => points[i]);
                const memberIds = memberIndices.map(i => points[i].id);
                
                // Calculate center as mean position
                const center = window.Hull.centroid(memberPoints);
                
                // Calculate convex hull
                const hull = window.Hull.convexHull(memberPoints);

                clusters.push({
                    id: window.Utils.uid('cluster'),
                    memberPropertyIds: memberIds,
                    center: center,
                    hull: hull,
                    createdAt: new Date().toISOString()
                });
            }
        }

        if (onProgress) {
            onProgress(1);
        }

        return clusters;
    };

    /**
     * Build a grid-based spatial index
     * @param {Array} points - Array of points
     * @param {number} epsMiles - Epsilon in miles
     * @returns {Object} Spatial index
     */
    function buildSpatialIndex(points, epsMiles) {
        // Convert eps from miles to approximate degrees
        // 1 degree latitude ≈ 69 miles
        // 1 degree longitude ≈ 69 * cos(lat) miles
        // Use average latitude for approximation
        
        let avgLat = 0;
        points.forEach(p => avgLat += p.lat);
        avgLat /= points.length;

        const latDegPerMile = 1 / 69;
        const lngDegPerMile = 1 / (69 * Math.cos(avgLat * Math.PI / 180));

        // Cell size slightly larger than eps to ensure all neighbors are found
        const cellSizeLat = epsMiles * latDegPerMile * 1.1;
        const cellSizeLng = epsMiles * lngDegPerMile * 1.1;

        const grid = new Map();

        points.forEach((point, index) => {
            const cellX = Math.floor(point.lng / cellSizeLng);
            const cellY = Math.floor(point.lat / cellSizeLat);
            const key = `${cellX},${cellY}`;

            if (!grid.has(key)) {
                grid.set(key, []);
            }
            grid.get(key).push(index);
        });

        return {
            grid,
            cellSizeLat,
            cellSizeLng,
            avgLat
        };
    }

    /**
     * Range query using spatial index
     * @param {Array} points - All points
     * @param {number} pointIndex - Index of query point
     * @param {Object} index - Spatial index
     * @param {number} epsMiles - Epsilon in miles
     * @returns {Array} Indices of neighbors
     */
    function rangeQuery(points, pointIndex, index, epsMiles) {
        const point = points[pointIndex];
        const { grid, cellSizeLat, cellSizeLng } = index;

        const cellX = Math.floor(point.lng / cellSizeLng);
        const cellY = Math.floor(point.lat / cellSizeLat);

        const neighbors = [];

        // Check current cell and all adjacent cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${cellX + dx},${cellY + dy}`;
                const cell = grid.get(key);
                
                if (cell) {
                    for (const idx of cell) {
                        if (idx !== pointIndex) {
                            const dist = haversineDistance(
                                point.lat, point.lng,
                                points[idx].lat, points[idx].lng
                            );
                            if (dist <= epsMiles) {
                                neighbors.push(idx);
                            }
                        }
                    }
                }
            }
        }

        // Include the point itself
        neighbors.push(pointIndex);
        
        return neighbors;
    }

    /**
     * Expand cluster from a core point
     */
    function expandCluster(points, labels, pointIndex, neighbors, clusterId, epsMiles, minPts, index) {
        labels[pointIndex] = clusterId;
        
        const queue = [...neighbors];
        const processed = new Set([pointIndex]);

        while (queue.length > 0) {
            const currentIdx = queue.shift();
            
            if (processed.has(currentIdx)) continue;
            processed.add(currentIdx);

            if (labels[currentIdx] === -1) {
                // Change noise to border point
                labels[currentIdx] = clusterId;
            }

            if (labels[currentIdx] !== -2) continue;

            labels[currentIdx] = clusterId;

            // Find neighbors of current point
            const currentNeighbors = rangeQuery(points, currentIdx, index, epsMiles);

            if (currentNeighbors.length >= minPts) {
                // Add new neighbors to queue
                for (const idx of currentNeighbors) {
                    if (!processed.has(idx)) {
                        queue.push(idx);
                    }
                }
            }
        }
    }

    /**
     * Haversine distance between two points in miles
     */
    function haversineDistance(lat1, lng1, lat2, lng2) {
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return EARTH_RADIUS_MILES * c;
    }

    /**
     * Filter points by price range
     * @param {Array} points - Array of points with price
     * @param {number} priceFrom - Minimum price
     * @param {number} priceTo - Maximum price
     * @returns {Array} Filtered points
     */
    DBSCAN.filterByPrice = function(points, priceFrom, priceTo) {
        return points.filter(p => {
            if (p.price === null || p.price === undefined || isNaN(p.price)) {
                return true; // Include points without price
            }
            return p.price >= priceFrom && p.price <= priceTo;
        });
    };

    /**
     * Get clustering statistics
     * @param {Array} clusters - Array of clusters
     * @param {Array} points - Original points
     * @returns {Object} Statistics
     */
    DBSCAN.getStats = function(clusters, points) {
        let clusteredCount = 0;
        let minSize = Infinity;
        let maxSize = 0;

        clusters.forEach(cluster => {
            const size = cluster.memberPropertyIds.length;
            clusteredCount += size;
            if (size < minSize) minSize = size;
            if (size > maxSize) maxSize = size;
        });

        return {
            totalClusters: clusters.length,
            clusteredPoints: clusteredCount,
            noisePoints: points.length - clusteredCount,
            minClusterSize: clusters.length > 0 ? minSize : 0,
            maxClusterSize: maxSize,
            avgClusterSize: clusters.length > 0 ? clusteredCount / clusters.length : 0
        };
    };

    // Expose to global scope
    global.DBSCAN = DBSCAN;

})(window);
