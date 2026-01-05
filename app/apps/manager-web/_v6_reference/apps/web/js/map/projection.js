/**
 * Projection.js - Coordinate transformation utilities
 * Uses Web Mercator projection for consistent map rendering
 */

(function(global) {
    'use strict';

    const Projection = {};

    // Earth radius in meters
    const EARTH_RADIUS = 6378137;
    const MAX_LATITUDE = 85.0511287798;

    /**
     * Convert latitude/longitude to Web Mercator coordinates
     * @param {number} lat - Latitude in degrees
     * @param {number} lng - Longitude in degrees
     * @returns {Object} { x, y } in meters
     */
    Projection.toMercator = function(lat, lng) {
        // Clamp latitude to valid range
        lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
        
        const x = lng * Math.PI / 180 * EARTH_RADIUS;
        const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) * EARTH_RADIUS;
        
        return { x, y };
    };

    /**
     * Convert Web Mercator coordinates to latitude/longitude
     * @param {number} x - X in meters
     * @param {number} y - Y in meters
     * @returns {Object} { lat, lng } in degrees
     */
    Projection.fromMercator = function(x, y) {
        const lng = x / EARTH_RADIUS * 180 / Math.PI;
        const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI;
        
        return { lat, lng };
    };

    /**
     * Convert latitude/longitude to screen coordinates
     * @param {number} lat - Latitude in degrees
     * @param {number} lng - Longitude in degrees
     * @param {Object} viewport - Viewport configuration
     * @returns {Object} { x, y } in screen pixels
     */
    Projection.toScreen = function(lat, lng, viewport) {
        const mercator = Projection.toMercator(lat, lng);
        const centerMercator = Projection.toMercator(viewport.centerLat, viewport.centerLng);
        
        // Calculate offset from center in meters
        const dx = mercator.x - centerMercator.x;
        const dy = mercator.y - centerMercator.y;
        
        // Convert to screen coordinates
        // Note: Y is inverted because screen Y increases downward
        const screenX = viewport.width / 2 + dx * viewport.scale;
        const screenY = viewport.height / 2 - dy * viewport.scale;
        
        return { x: screenX, y: screenY };
    };

    /**
     * Convert screen coordinates to latitude/longitude
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @param {Object} viewport - Viewport configuration
     * @returns {Object} { lat, lng } in degrees
     */
    Projection.fromScreen = function(screenX, screenY, viewport) {
        const centerMercator = Projection.toMercator(viewport.centerLat, viewport.centerLng);
        
        // Convert from screen to mercator offset
        const dx = (screenX - viewport.width / 2) / viewport.scale;
        const dy = (viewport.height / 2 - screenY) / viewport.scale;
        
        // Calculate absolute mercator coordinates
        const x = centerMercator.x + dx;
        const y = centerMercator.y + dy;
        
        return Projection.fromMercator(x, y);
    };

    /**
     * Calculate scale factor (pixels per meter) for a given zoom level
     * @param {number} zoom - Zoom level (1.0 = default)
     * @param {number} baseScale - Base pixels per meter at zoom 1.0
     * @returns {number} Scale factor
     */
    Projection.getScale = function(zoom, baseScale = 0.00001) {
        return baseScale * zoom;
    };

    /**
     * Calculate viewport to fit all points with padding
     * @param {Array} points - Array of { lat, lng } objects
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     * @param {number} padding - Padding in pixels
     * @returns {Object} Viewport configuration
     */
    Projection.fitToPoints = function(points, width, height, padding = 40) {
        if (!points || points.length === 0) {
            return {
                centerLat: 39.8283,
                centerLng: -98.5795,
                scale: 0.00001,
                width,
                height
            };
        }

        // Find bounding box
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;

        points.forEach(p => {
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
            if (p.lng < minLng) minLng = p.lng;
            if (p.lng > maxLng) maxLng = p.lng;
        });

        // Calculate center
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;

        // Convert bounds to mercator
        const minMercator = Projection.toMercator(minLat, minLng);
        const maxMercator = Projection.toMercator(maxLat, maxLng);

        // Calculate required scale
        const dataWidth = Math.abs(maxMercator.x - minMercator.x);
        const dataHeight = Math.abs(maxMercator.y - minMercator.y);

        const availableWidth = width - 2 * padding;
        const availableHeight = height - 2 * padding;

        let scale;
        if (dataWidth === 0 && dataHeight === 0) {
            scale = 0.0001;
        } else if (dataWidth === 0) {
            scale = availableHeight / dataHeight;
        } else if (dataHeight === 0) {
            scale = availableWidth / dataWidth;
        } else {
            scale = Math.min(availableWidth / dataWidth, availableHeight / dataHeight);
        }

        // Clamp scale to reasonable bounds
        scale = Math.max(0.0000001, Math.min(0.01, scale));

        return {
            centerLat,
            centerLng,
            scale,
            width,
            height
        };
    };

    /**
     * Check if a screen point is within bounds
     * @param {number} x - Screen X
     * @param {number} y - Screen Y
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     * @param {number} margin - Optional margin
     * @returns {boolean} True if within bounds
     */
    Projection.isInBounds = function(x, y, width, height, margin = 0) {
        return x >= -margin && x <= width + margin && 
               y >= -margin && y <= height + margin;
    };

    /**
     * Calculate distance between two screen points
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Distance in pixels
     */
    Projection.screenDistance = function(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Expose to global scope
    global.Projection = Projection;

})(window);
