/**
 * Basemap.js - Procedural map background rendering
 * Generates a subtle, professional-looking basemap without network requests
 */

(function(global) {
    'use strict';

    const Basemap = {};

    // --- Real tile basemap (OSM raster) ---
    // Renders a real slippy-map behind the overlays when internet is available.
    // Falls back to the procedural basemap if tiles can't load.
    const TILE_SIZE = 256;
    const MAX_TILE_CACHE = 256;
    const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const EARTH_RADIUS = 6378137;

    class TileCache {
        constructor() {
            this.map = new Map();
            this.errorCount = 0;
            this.loadedCount = 0;
            this.lastPrune = 0;
        }

        key(z, x, y) {
            return `${z}/${x}/${y}`;
        }

        get(z, x, y) {
            return this.map.get(this.key(z, x, y));
        }

        set(z, x, y, val) {
            this.map.set(this.key(z, x, y), val);
        }

        prune() {
            // Simple LRU-ish prune based on lastUsed
            if (this.map.size <= MAX_TILE_CACHE) return;
            const entries = Array.from(this.map.entries());
            entries.sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
            const removeCount = Math.max(0, this.map.size - MAX_TILE_CACHE);
            for (let i = 0; i < removeCount; i++) {
                this.map.delete(entries[i][0]);
            }
        }

        request(z, x, y) {
            const now = performance.now();
            const key = this.key(z, x, y);
            const existing = this.map.get(key);
            if (existing) {
                existing.lastUsed = now;
                return existing;
            }

            const img = new Image();
            // NOTE: We never read pixels from the canvas, so CORS tainting is fine.
            img.decoding = 'async';

            const entry = {
                img,
                state: 'loading',
                lastUsed: now
            };
            this.map.set(key, entry);

            img.onload = () => {
                entry.state = 'loaded';
                entry.lastUsed = performance.now();
                this.loadedCount++;
                global.dispatchEvent(new CustomEvent('basemap:tileLoaded'));
            };
            img.onerror = () => {
                entry.state = 'error';
                entry.lastUsed = performance.now();
                this.errorCount++;
                global.dispatchEvent(new CustomEvent('basemap:tileLoaded'));
            };

            img.src = TILE_URL
                .replace('{z}', String(z))
                .replace('{x}', String(x))
                .replace('{y}', String(y));

            // Prune occasionally
            if (now - this.lastPrune > 1000) {
                this.prune();
                this.lastPrune = now;
            }

            return entry;
        }
    }

    const tileCache = new TileCache();

    function clamp(n, a, b) {
        return Math.max(a, Math.min(b, n));
    }

    function latLngToWorldPx(lat, lng, z) {
        const worldSize = TILE_SIZE * Math.pow(2, z);
        const x = (lng + 180) / 360 * worldSize;
        const latRad = lat * Math.PI / 180;
        const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * worldSize;
        return { x, y, worldSize };
    }

    function scaleToZoom(scale) {
        // scale = pixels per meter
        const ppm = scale;
        const z = Math.log2((ppm * 2 * Math.PI * EARTH_RADIUS) / TILE_SIZE);
        return clamp(z, 1, 20);
    }

    function drawRealTiles(ctx, viewport, opts = {}) {
        const { width, height, centerLat, centerLng, scale } = viewport;

        // If we're offline (or the browser says we are), skip real tiles.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

        // Too many errors -> fallback.
        if (tileCache.errorCount >= 25 && tileCache.loadedCount === 0) return false;

        // IMPORTANT: keep basemap and overlays in the same continuous zoom space.
        // We render integer zoom tiles (z0) but scale them by a fractional factor,
        // so clusters/points don't "drift" against the map while zooming/panning.
        const zoomFloat = scaleToZoom(scale);
        const z0 = clamp(Math.floor(zoomFloat), 2, 19);
        const fracScale = Math.pow(2, zoomFloat - z0);

        const center = latLngToWorldPx(centerLat, centerLng, z0);
        // Convert screen px to world px at zoom z0 (accounting for fractional scaling)
        const topLeftX = center.x - (width / (2 * fracScale));
        const topLeftY = center.y - (height / (2 * fracScale));

        const viewW = width / fracScale;
        const viewH = height / fracScale;

        const minTileX = Math.floor(topLeftX / TILE_SIZE);
        const minTileY = Math.floor(topLeftY / TILE_SIZE);
        const maxTileX = Math.floor((topLeftX + viewW) / TILE_SIZE);
        const maxTileY = Math.floor((topLeftY + viewH) / TILE_SIZE);

        const tilesPerAxis = Math.pow(2, z0);
        let anyLoaded = false;

        // Subtle placeholder background
        ctx.fillStyle = '#0B1020';
        ctx.fillRect(0, 0, width, height);

        for (let ty = minTileY; ty <= maxTileY; ty++) {
            if (ty < 0 || ty >= tilesPerAxis) continue;
            for (let tx = minTileX; tx <= maxTileX; tx++) {
                let wrappedX = tx % tilesPerAxis;
                if (wrappedX < 0) wrappedX += tilesPerAxis;

                const entry = tileCache.request(z0, wrappedX, ty);
                const dx = (tx * TILE_SIZE - topLeftX) * fracScale;
                const dy = (ty * TILE_SIZE - topLeftY) * fracScale;
                const size = TILE_SIZE * fracScale;

                if (entry.state === 'loaded') {
                    anyLoaded = true;
                    ctx.drawImage(entry.img, Math.round(dx), Math.round(dy), Math.ceil(size), Math.ceil(size));
                } else {
                    // Loading / error placeholder tile
                    ctx.fillStyle = entry.state === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.08)';
                    ctx.fillRect(Math.round(dx), Math.round(dy), Math.ceil(size), Math.ceil(size));
                }
            }
        }

        // Tint to match Block's dark UI (keeps map readable but not too bright)
        ctx.fillStyle = 'rgba(6, 8, 20, 0.35)';
        ctx.fillRect(0, 0, width, height);

        // Optionally draw a very subtle grid overlay for depth
        if (opts.gridOverlay) {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
            ctx.lineWidth = 1;
            const step = 128;
            for (let x = 0; x <= width; x += step) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y <= height; y += step) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }

        return anyLoaded;
    }

    // Color palette for basemap
    const COLORS = {
        background: '#F1F5F9',
        land: '#E8EDEB',
        water: '#B8D4E3',
        road: '#FFFFFF',
        roadStroke: '#D1D5DB',
        park: '#C8E6C9',
        building: '#E0E0E0',
        grid: '#E2E8F0'
    };

    /**
     * Seeded random number generator for deterministic rendering
     */
    class SeededRandom {
        constructor(seed) {
            this.seed = seed;
        }
        
        next() {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            return this.seed / 233280;
        }
        
        range(min, max) {
            return min + this.next() * (max - min);
        }
        
        int(min, max) {
            return Math.floor(this.range(min, max + 1));
        }
    }

    /**
     * Draw the basemap on a canvas context
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} viewport - Viewport configuration
     */
    Basemap.draw = function(ctx, viewport, options = {}) {
        const { width, height, centerLat, centerLng, scale } = viewport;
        
        const mode = options.mode || 'auto'; // auto | tiles | procedural

        // Prefer real tiles when available
        const wantTiles = (mode === 'tiles') || (mode === 'auto');

        if (wantTiles) {
            const drewTiles = drawRealTiles(ctx, viewport, { gridOverlay: false });
            if (drewTiles) {
                return;
            }
        }

        // --- Procedural fallback ---
        // Fill background
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines based on scale
        drawGrid(ctx, viewport);

        // Draw procedural features based on location
        const seed = Math.floor(centerLat * 1000 + centerLng * 100);
        const rng = new SeededRandom(seed);

        // Draw some water bodies
        drawWater(ctx, viewport, rng);

        // Draw parks
        drawParks(ctx, viewport, rng);

        // Draw roads
        drawRoads(ctx, viewport, rng);

        // Draw blocks/buildings
        drawBlocks(ctx, viewport, rng);
    };

    /**
     * Draw grid lines
     */
    function drawGrid(ctx, viewport) {
        const { width, height, scale } = viewport;
        
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.5;
        
        // Calculate grid spacing based on scale
        const baseSpacing = 1000; // meters
        let gridSpacing = baseSpacing;
        
        // Adjust grid spacing based on zoom
        const pixelSpacing = gridSpacing * scale;
        if (pixelSpacing < 20) {
            gridSpacing = baseSpacing * 10;
        } else if (pixelSpacing > 200) {
            gridSpacing = baseSpacing / 10;
        }
        
        const finalSpacing = gridSpacing * scale;
        
        // Draw vertical lines
        const startX = (width / 2) % finalSpacing;
        for (let x = startX; x < width; x += finalSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        const startY = (height / 2) % finalSpacing;
        for (let y = startY; y < height; y += finalSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    /**
     * Draw water features
     */
    function drawWater(ctx, viewport, rng) {
        const { width, height } = viewport;
        
        ctx.fillStyle = COLORS.water;
        
        // Generate a few water bodies
        const numWater = rng.int(0, 2);
        for (let i = 0; i < numWater; i++) {
            const x = rng.range(width * 0.1, width * 0.9);
            const y = rng.range(height * 0.1, height * 0.9);
            const w = rng.range(50, 150);
            const h = rng.range(30, 100);
            
            ctx.beginPath();
            ctx.ellipse(x, y, w, h, rng.range(0, Math.PI), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Draw park areas
     */
    function drawParks(ctx, viewport, rng) {
        const { width, height } = viewport;
        
        ctx.fillStyle = COLORS.park;
        
        const numParks = rng.int(2, 5);
        for (let i = 0; i < numParks; i++) {
            const x = rng.range(0, width);
            const y = rng.range(0, height);
            const w = rng.range(40, 120);
            const h = rng.range(40, 120);
            
            ctx.beginPath();
            roundedRect(ctx, x - w/2, y - h/2, w, h, 8);
            ctx.fill();
        }
    }

    /**
     * Draw road network
     */
    function drawRoads(ctx, viewport, rng) {
        const { width, height } = viewport;
        
        // Major roads (horizontal and vertical)
        ctx.strokeStyle = COLORS.road;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        
        // Horizontal major roads
        const numHRoads = rng.int(2, 4);
        for (let i = 0; i < numHRoads; i++) {
            const y = rng.range(height * 0.15, height * 0.85);
            ctx.beginPath();
            ctx.moveTo(0, y);
            
            // Add some curves
            let x = 0;
            while (x < width) {
                const nextX = Math.min(x + rng.range(100, 300), width);
                const cp1x = x + (nextX - x) / 3;
                const cp2x = x + 2 * (nextX - x) / 3;
                const variance = rng.range(-20, 20);
                ctx.bezierCurveTo(cp1x, y + variance, cp2x, y - variance, nextX, y);
                x = nextX;
            }
            ctx.stroke();
        }
        
        // Vertical major roads
        const numVRoads = rng.int(2, 4);
        for (let i = 0; i < numVRoads; i++) {
            const x = rng.range(width * 0.15, width * 0.85);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            
            let y = 0;
            while (y < height) {
                const nextY = Math.min(y + rng.range(100, 300), height);
                const cp1y = y + (nextY - y) / 3;
                const cp2y = y + 2 * (nextY - y) / 3;
                const variance = rng.range(-20, 20);
                ctx.bezierCurveTo(x + variance, cp1y, x - variance, cp2y, x, nextY);
                y = nextY;
            }
            ctx.stroke();
        }
        
        // Minor roads (thinner)
        ctx.lineWidth = 3;
        ctx.strokeStyle = COLORS.roadStroke;
        
        const numMinorRoads = rng.int(5, 12);
        for (let i = 0; i < numMinorRoads; i++) {
            const isHorizontal = rng.next() > 0.5;
            
            ctx.beginPath();
            if (isHorizontal) {
                const y = rng.range(0, height);
                const startX = rng.range(0, width * 0.3);
                const endX = rng.range(width * 0.7, width);
                ctx.moveTo(startX, y);
                ctx.lineTo(endX, y + rng.range(-30, 30));
            } else {
                const x = rng.range(0, width);
                const startY = rng.range(0, height * 0.3);
                const endY = rng.range(height * 0.7, height);
                ctx.moveTo(x, startY);
                ctx.lineTo(x + rng.range(-30, 30), endY);
            }
            ctx.stroke();
        }
    }

    /**
     * Draw building blocks
     */
    function drawBlocks(ctx, viewport, rng) {
        const { width, height, scale } = viewport;
        
        // Only draw blocks when zoomed in enough
        if (scale < 0.00005) return;
        
        ctx.fillStyle = COLORS.building;
        ctx.strokeStyle = COLORS.roadStroke;
        ctx.lineWidth = 0.5;
        
        const numBlocks = rng.int(20, 50);
        const blockSize = Math.max(8, Math.min(30, 20 * scale * 100000));
        
        for (let i = 0; i < numBlocks; i++) {
            const x = rng.range(0, width);
            const y = rng.range(0, height);
            const w = rng.range(blockSize * 0.5, blockSize * 1.5);
            const h = rng.range(blockSize * 0.5, blockSize * 1.5);
            
            ctx.beginPath();
            ctx.rect(x - w/2, y - h/2, w, h);
            ctx.fill();
            ctx.stroke();
        }
    }

    /**
     * Helper to draw rounded rectangle
     */
    function roundedRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }

    /**
     * Create an offscreen canvas for caching
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {Object} viewport - Viewport for rendering
     * @returns {HTMLCanvasElement} Offscreen canvas
     */
    Basemap.createCache = function(width, height, viewport) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        Basemap.draw(ctx, viewport);
        return canvas;
    };

    // Expose to global scope
    global.Basemap = Basemap;

})(window);
