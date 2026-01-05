/**
 * Overlay.js - Render clusters, properties, and points on the map
 */

(function(global) {
    'use strict';

    const Overlay = {};

    // Maximum points to render for performance
    const MAX_RENDER_POINTS = 8000;

    /**
     * Draw cluster hulls on the canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} viewport - Viewport configuration
     * @param {Array} clusters - Array of cluster objects
     * @param {string|null} selectedClusterId - ID of selected cluster
     */
    Overlay.drawClusters = function(ctx, viewport, clusters, selectedClusterId = null) {
        if (!clusters || clusters.length === 0) return;

        clusters.forEach(cluster => {
            if (!cluster.hull || cluster.hull.length < 3) return;

            const isSelected = cluster.id === selectedClusterId;
            const color = cluster.color || '#4F46E5';

            // Convert hull points to screen coordinates
            const screenPoints = cluster.hull.map(pt => 
                window.Projection.toScreen(pt.lat, pt.lng, viewport)
            );

            // Draw filled hull
            ctx.beginPath();
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
            for (let i = 1; i < screenPoints.length; i++) {
                ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
            }
            ctx.closePath();

            // Fill with semi-transparent color
            ctx.fillStyle = hexToRgba(color, isSelected ? 0.35 : 0.2);
            ctx.fill();

            // Stroke outline
            ctx.strokeStyle = color;
            ctx.lineWidth = isSelected ? 3 : 1.5;
            ctx.stroke();
        });
    };

    /**
     * Draw property points on the canvas with sampling
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} viewport - Viewport configuration
     * @param {Array} properties - Array of property objects
     * @param {Array} clusters - Array of clusters to color-code
     * @param {string|null} selectedClusterId - ID of selected cluster
     * @returns {Object} { rendered, total } count info
     */
    Overlay.drawProperties = function(ctx, viewport, properties, clusters, selectedClusterId = null, renderOptions = {}) {
        if (!properties || properties.length === 0) {
            return { rendered: 0, total: 0 };
        }

        const total = properties.length;
        
        // Build cluster membership map
        const clusterMap = new Map();
        if (clusters) {
            clusters.forEach(cluster => {
                if (cluster.memberPropertyIds) {
                    cluster.memberPropertyIds.forEach(id => {
                        clusterMap.set(id, cluster);
                    });
                }
            });
        }

        // Sample if too many points
        const maxPoints = typeof renderOptions.maxPoints === 'number' ? renderOptions.maxPoints : MAX_RENDER_POINTS;
        let propsToRender = properties;
        if (properties.length > maxPoints) {
            propsToRender = samplePoints(properties, maxPoints);
        }

        const rendered = propsToRender.length;

        // Draw each point
        propsToRender.forEach(prop => {
            const screen = window.Projection.toScreen(prop.lat, prop.lng, viewport);
            
            // Skip if off-screen
            if (!window.Projection.isInBounds(screen.x, screen.y, viewport.width, viewport.height, 10)) {
                return;
            }

            const cluster = clusterMap.get(prop.id);
            let color = '#94A3B8'; // Default gray for unclustered
            let radius = 3;
            let alpha = 0.6;

            if (cluster) {
                color = cluster.color || '#4F46E5';
                alpha = cluster.id === selectedClusterId ? 0.9 : 0.7;
                radius = cluster.id === selectedClusterId ? 4 : 3;
            }

            // Draw anti-aliased circle
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(color, alpha);
            ctx.fill();
        });

        return { rendered, total };
    };

    /**
     * Draw cluster center pins and labels
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} viewport - Viewport configuration
     * @param {Array} clusters - Array of cluster objects
     * @param {string|null} selectedClusterId - ID of selected cluster
     */
    Overlay.drawClusterCenters = function(ctx, viewport, clusters, selectedClusterId = null) {
        if (!clusters || clusters.length === 0) return;

        clusters.forEach((cluster, index) => {
            if (!cluster.center) return;

            const screen = window.Projection.toScreen(
                cluster.center.lat, 
                cluster.center.lng, 
                viewport
            );

            if (!window.Projection.isInBounds(screen.x, screen.y, viewport.width, viewport.height, 20)) {
                return;
            }

            const isSelected = cluster.id === selectedClusterId;
            const color = cluster.color || '#4F46E5';

            // Draw pin
            const pinSize = isSelected ? 12 : 10;
            
            // Pin body (drop shape)
            ctx.beginPath();
            ctx.arc(screen.x, screen.y - pinSize, pinSize / 2, Math.PI, 0);
            ctx.lineTo(screen.x, screen.y);
            ctx.closePath();
            
            ctx.fillStyle = color;
            ctx.fill();
            
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner dot
            ctx.beginPath();
            ctx.arc(screen.x, screen.y - pinSize, pinSize / 4, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            // Label
            const label = `C${index + 1}`;
            ctx.font = `${isSelected ? 'bold ' : ''}11px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            // Label background
            const textWidth = ctx.measureText(label).width;
            const labelX = screen.x;
            const labelY = screen.y - pinSize - 8;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            roundedRect(ctx, labelX - textWidth/2 - 4, labelY - 12, textWidth + 8, 14, 3);
            ctx.fill();
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Label text
            ctx.fillStyle = color;
            ctx.fillText(label, labelX, labelY);
        });
    };

    /**
     * Draw rep pins on the map
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} viewport - Viewport configuration
     * @param {Array} reps - Array of rep objects with optional lat/lng
     */
    Overlay.drawReps = function(ctx, viewport, reps) {
        if (!reps || reps.length === 0) return;

        // Draw reps at their real home base coordinates when available.
        // If a rep has no homeLat/homeLng, we simply don't draw them on the map
        // (instead of faking positions near the viewport center).
        reps.forEach((rep) => {
            const lat = (rep.homeLat !== undefined && rep.homeLat !== null) ? parseFloat(rep.homeLat) : null;
            const lng = (rep.homeLng !== undefined && rep.homeLng !== null) ? parseFloat(rep.homeLng) : null;

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            
            const screen = window.Projection.toScreen(lat, lng, viewport);
            
            if (!window.Projection.isInBounds(screen.x, screen.y, viewport.width, viewport.height, 20)) {
                return;
            }

            const color = rep.color || '#4F46E5';

            // Draw person icon
            const size = 24;
            
            // Background circle
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, size / 2, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Person icon (simplified)
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y - 3, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(screen.x, screen.y + 6, 6, Math.PI, 0);
            ctx.fill();

            // Name label
            ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const name = rep.name || 'Unknown';
            const textWidth = ctx.measureText(name).width;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            roundedRect(ctx, screen.x - textWidth/2 - 4, screen.y + size/2 + 2, textWidth + 8, 16, 3);
            ctx.fill();
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#1E293B';
            ctx.fillText(name, screen.x, screen.y + size/2 + 5);
        });
    };

    /**
     * Sample points deterministically
     * @param {Array} points - All points
     * @param {number} maxPoints - Maximum points to return
     * @returns {Array} Sampled points
     */
    function samplePoints(points, maxPoints) {
        if (points.length <= maxPoints) return points;

        const sampled = [];
        const step = points.length / maxPoints;
        
        // Use stable hash for deterministic sampling
        const sorted = [...points].sort((a, b) => {
            const hashA = window.Utils.stableHash(a.id);
            const hashB = window.Utils.stableHash(b.id);
            return hashA - hashB;
        });

        for (let i = 0; i < maxPoints; i++) {
            const idx = Math.floor(i * step);
            sampled.push(sorted[idx]);
        }

        return sampled;
    }

    /**
     * Convert hex color to rgba
     * @param {string} hex - Hex color
     * @param {number} alpha - Alpha value (0-1)
     * @returns {string} RGBA color string
     */
    function hexToRgba(hex, alpha) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return `rgba(0, 0, 0, ${alpha})`;
        
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Draw a rounded rectangle path
     */
    function roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    /**
     * Hit test for cluster selection
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     * @param {Object} viewport - Viewport configuration
     * @param {Array} clusters - Array of clusters
     * @returns {Object|null} Hit cluster or null
     */
    Overlay.hitTestCluster = function(x, y, viewport, clusters) {
        if (!clusters || clusters.length === 0) return null;

        // Check in reverse order (top items first)
        for (let i = clusters.length - 1; i >= 0; i--) {
            const cluster = clusters[i];
            
            // First check center pin
            if (cluster.center) {
                const centerScreen = window.Projection.toScreen(
                    cluster.center.lat, 
                    cluster.center.lng, 
                    viewport
                );
                
                const dist = window.Projection.screenDistance(x, y, centerScreen.x, centerScreen.y);
                if (dist < 15) {
                    return cluster;
                }
            }

            // Then check hull
            if (cluster.hull && cluster.hull.length >= 3) {
                const screenPoints = cluster.hull.map(pt => 
                    window.Projection.toScreen(pt.lat, pt.lng, viewport)
                );
                
                if (pointInPolygon(x, y, screenPoints)) {
                    return cluster;
                }
            }
        }

        return null;
    };

    /**
     * Check if point is inside polygon
     */
    function pointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    // Expose to global scope
    global.Overlay = Overlay;

})(window);
