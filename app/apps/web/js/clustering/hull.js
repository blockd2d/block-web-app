/**
 * Hull.js - Convex hull computation using Graham scan
 */

(function(global) {
    'use strict';

    const Hull = {};

    /**
     * Compute convex hull of points using Graham scan algorithm
     * @param {Array} points - Array of { lat, lng } objects
     * @returns {Array} Hull points in counter-clockwise order
     */
    Hull.convexHull = function(points) {
        if (!points || points.length < 3) {
            return points ? [...points] : [];
        }

        // Find the point with lowest y (lat), ties broken by lowest x (lng)
        let lowest = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].lat < points[lowest].lat ||
                (points[i].lat === points[lowest].lat && points[i].lng < points[lowest].lng)) {
                lowest = i;
            }
        }

        // Put lowest point first
        const pivot = points[lowest];
        const rest = points.filter((_, i) => i !== lowest);

        // Sort by polar angle with respect to pivot
        rest.sort((a, b) => {
            const angleA = Math.atan2(a.lat - pivot.lat, a.lng - pivot.lng);
            const angleB = Math.atan2(b.lat - pivot.lat, b.lng - pivot.lng);
            
            if (angleA !== angleB) {
                return angleA - angleB;
            }
            
            // If same angle, sort by distance (closer first)
            const distA = (a.lat - pivot.lat) ** 2 + (a.lng - pivot.lng) ** 2;
            const distB = (b.lat - pivot.lat) ** 2 + (b.lng - pivot.lng) ** 2;
            return distA - distB;
        });

        // Build hull using stack
        const stack = [pivot];
        
        for (const point of rest) {
            // Remove points that make clockwise turn
            while (stack.length > 1 && crossProduct(stack[stack.length - 2], stack[stack.length - 1], point) <= 0) {
                stack.pop();
            }
            stack.push(point);
        }

        return stack;
    };

    /**
     * Cross product of vectors OA and OB
     * @returns positive if counter-clockwise, negative if clockwise, 0 if collinear
     */
    function crossProduct(o, a, b) {
        return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
    }

    /**
     * Calculate centroid (center of mass) of points
     * @param {Array} points - Array of { lat, lng } objects
     * @returns {Object} { lat, lng } centroid
     */
    Hull.centroid = function(points) {
        if (!points || points.length === 0) {
            return { lat: 0, lng: 0 };
        }

        let sumLat = 0;
        let sumLng = 0;

        points.forEach(p => {
            sumLat += p.lat;
            sumLng += p.lng;
        });

        return {
            lat: sumLat / points.length,
            lng: sumLng / points.length
        };
    };

    /**
     * Calculate area of a polygon using shoelace formula
     * @param {Array} polygon - Array of { lat, lng } vertices
     * @returns {number} Area (in square degrees, approximate)
     */
    Hull.area = function(polygon) {
        if (!polygon || polygon.length < 3) {
            return 0;
        }

        let area = 0;
        const n = polygon.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += polygon[i].lng * polygon[j].lat;
            area -= polygon[j].lng * polygon[i].lat;
        }

        return Math.abs(area) / 2;
    };

    /**
     * Check if a point is inside a polygon
     * @param {Object} point - { lat, lng }
     * @param {Array} polygon - Array of { lat, lng } vertices
     * @returns {boolean} True if inside
     */
    Hull.pointInPolygon = function(point, polygon) {
        if (!polygon || polygon.length < 3) {
            return false;
        }

        let inside = false;
        const x = point.lng;
        const y = point.lat;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lng, yi = polygon[i].lat;
            const xj = polygon[j].lng, yj = polygon[j].lat;

            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    };

    /**
     * Calculate bounding box of points
     * @param {Array} points - Array of { lat, lng }
     * @returns {Object} { minLat, maxLat, minLng, maxLng }
     */
    Hull.boundingBox = function(points) {
        if (!points || points.length === 0) {
            return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
        }

        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;

        points.forEach(p => {
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
            if (p.lng < minLng) minLng = p.lng;
            if (p.lng > maxLng) maxLng = p.lng;
        });

        return { minLat, maxLat, minLng, maxLng };
    };

    // Expose to global scope
    global.Hull = Hull;

})(window);
