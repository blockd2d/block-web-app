/**
 * MapView.js - Main map component with pan/zoom and rendering
 */

(function(global) {
    'use strict';

    /**
     * MapView class - handles canvas map with pan/zoom
     */
    class MapView {
        constructor(canvasId, options = {}) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) {
                console.error('Canvas not found:', canvasId);
                return;
            }

            // Optional basemap canvas (real tiles / procedural)
            this.basemapCanvas = document.getElementById('basemapCanvas') || null;

            // Contexts
            this.ctx = this.canvas.getContext('2d');
            this.baseCtx = this.basemapCanvas ? this.basemapCanvas.getContext('2d') : this.ctx;

            // Render scheduling (avoid re-rendering on every mousemove)
            this._raf = null;
            this._dirtyBasemap = true;
            this._dirtyOverlay = true;
            this.isInteracting = false;

            // Re-render when a basemap tile finishes loading
            this._onTileLoaded = () => this.invalidate({ basemap: true });
            window.addEventListener('basemap:tileLoaded', this._onTileLoaded);
            this.options = {
                showProperties: options.showProperties !== false,
                showClusters: options.showClusters !== false,
                showReps: options.showReps || false,
                ...options
            };

            // Viewport state
            this.viewport = {
                centerLat: 39.8283,
                centerLng: -98.5795,
                scale: 0.00005,
                width: 0,
                height: 0
            };

            // Zoom constraints
            // scale = pixels per meter (WebMercator). Default ranges were too tight.
            // z≈3 at ~5e-5; z≈18 at ~1.0; z≈20 at ~6.7
            this.minScale = 0.0000025;
            this.maxScale = 2.5;
            // Smaller factor = smoother zoom (feels less "jumpy")
            this.zoomFactor = 1.25;

            // Pan state
            this.isPanning = false;
            this.panStart = { x: 0, y: 0 };
            this.panStartCenter = { lat: 0, lng: 0 };

            // Data
            this.properties = [];
            this.clusters = [];
            this.reps = [];
            this.selectedClusterId = null;

            // Render stats
            this.renderStats = { rendered: 0, total: 0 };

            // Callbacks
            this.onClusterSelect = null;
            this.onZoomChange = null;

            // Initialize
            this.setupCanvas();
            this.setupEventListeners();
            this.invalidate({ basemap: true, overlay: true });
        }

        /**
         * Setup canvas size
         */
        setupCanvas() {
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            
            // Account for device pixel ratio for sharp rendering
            const dpr = window.devicePixelRatio || 1;

            // Overlay canvas
            this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
            this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Basemap canvas (if present)
            if (this.basemapCanvas) {
                this.basemapCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
                this.basemapCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
                this.basemapCanvas.style.width = rect.width + 'px';
                this.basemapCanvas.style.height = rect.height + 'px';
                this.baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
            
            this.viewport.width = rect.width;
            this.viewport.height = rect.height;

            this._dirtyBasemap = true;
            this._dirtyOverlay = true;
        }

        /**
         * Setup event listeners for interaction
         */
        setupEventListeners() {
            // Resize handler
            this.resizeHandler = window.Utils.debounce(() => {
                this.setupCanvas();
                this.invalidate({ basemap: true, overlay: true });
            }, 200);
            window.addEventListener('resize', this.resizeHandler);

            // Mouse events for panning
            this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

            // Touch events for panning
            this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
            this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
            this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

            // Wheel event for zooming
            this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

            // Click for selection
            this.canvas.addEventListener('click', (e) => this.handleClick(e));

            // Setup control buttons
            this.setupControls();
        }

        /**
         * Setup map control buttons
         */
        setupControls() {
            const zoomIn = document.getElementById('zoomIn');
            const zoomOut = document.getElementById('zoomOut');
            const resetView = document.getElementById('resetView');
            const fitData = document.getElementById('fitData');

            if (zoomIn) {
                zoomIn.addEventListener('click', () => this.zoomIn());
            }
            if (zoomOut) {
                zoomOut.addEventListener('click', () => this.zoomOut());
            }
            if (resetView) {
                resetView.addEventListener('click', () => this.resetView());
            }
            if (fitData) {
                fitData.addEventListener('click', () => this.fitToData());
            }
        }

        /**
         * Handle mouse down
         */
        handleMouseDown(e) {
            this.isPanning = true;
            this.isInteracting = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.panStartCenter = { 
                lat: this.viewport.centerLat, 
                lng: this.viewport.centerLng 
            };
            this.canvas.style.cursor = 'grabbing';
        }

        /**
         * Handle mouse move
         */
        handleMouseMove(e) {
            if (!this.isPanning) {
                // Check for hover on clusters
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const hit = window.Overlay.hitTestCluster(x, y, this.viewport, this.clusters);
                this.canvas.style.cursor = hit ? 'pointer' : 'grab';
                return;
            }

            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;

            // Convert pixel movement to coordinate change
            const startMercator = window.Projection.toMercator(
                this.panStartCenter.lat, 
                this.panStartCenter.lng
            );
            
            const newX = startMercator.x - dx / this.viewport.scale;
            const newY = startMercator.y + dy / this.viewport.scale;
            
            const newCoords = window.Projection.fromMercator(newX, newY);
            
            this.viewport.centerLat = newCoords.lat;
            this.viewport.centerLng = newCoords.lng;

            this.invalidate({ basemap: true, overlay: true });
        }

        /**
         * Handle mouse up
         */
        handleMouseUp(e) {
            this.isPanning = false;
            this.isInteracting = false;
            this.canvas.style.cursor = 'grab';
            this.invalidate({ basemap: true, overlay: true });
        }

        /**
         * Handle touch start
         */
        handleTouchStart(e) {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.isPanning = true;
                this.isInteracting = true;
                this.panStart = { x: touch.clientX, y: touch.clientY };
                this.panStartCenter = { 
                    lat: this.viewport.centerLat, 
                    lng: this.viewport.centerLng 
                };
            }
        }

        /**
         * Handle touch move
         */
        handleTouchMove(e) {
            if (!this.isPanning || e.touches.length !== 1) return;
            e.preventDefault();

            const touch = e.touches[0];
            const dx = touch.clientX - this.panStart.x;
            const dy = touch.clientY - this.panStart.y;

            const startMercator = window.Projection.toMercator(
                this.panStartCenter.lat, 
                this.panStartCenter.lng
            );
            
            const newX = startMercator.x - dx / this.viewport.scale;
            const newY = startMercator.y + dy / this.viewport.scale;
            
            const newCoords = window.Projection.fromMercator(newX, newY);
            
            this.viewport.centerLat = newCoords.lat;
            this.viewport.centerLng = newCoords.lng;

            this.invalidate({ basemap: true, overlay: true });
        }

        /**
         * Handle touch end
         */
        handleTouchEnd(e) {
            this.isPanning = false;
            this.isInteracting = false;
            this.invalidate({ basemap: true, overlay: true });
        }

        /**
         * Handle wheel zoom
         */
        handleWheel(e) {
            e.preventDefault();

            this.isInteracting = true;

            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Get coordinates under mouse before zoom
            const coordsBefore = window.Projection.fromScreen(mouseX, mouseY, this.viewport);

            // Adjust zoom
            const delta = e.deltaY > 0 ? 1 / this.zoomFactor : this.zoomFactor;
            this.viewport.scale = window.Utils.clamp(
                this.viewport.scale * delta,
                this.minScale,
                this.maxScale
            );

            // Get coordinates under mouse after zoom
            const coordsAfter = window.Projection.fromScreen(mouseX, mouseY, this.viewport);

            // Adjust center to keep mouse position stable
            this.viewport.centerLat += coordsBefore.lat - coordsAfter.lat;
            this.viewport.centerLng += coordsBefore.lng - coordsAfter.lng;

            this.invalidate({ basemap: true, overlay: true });
            this.updateZoomDisplay();

            // End interaction shortly after wheel stops
            clearTimeout(this._interactionEndTimeout);
            this._interactionEndTimeout = setTimeout(() => {
                this.isInteracting = false;
                this.invalidate({ basemap: true, overlay: true });
            }, 140);
        }

        /**
         * Handle click for selection
         */
        handleClick(e) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const hit = window.Overlay.hitTestCluster(x, y, this.viewport, this.clusters);
            
            if (hit) {
                this.selectCluster(hit.id);
            } else {
                this.selectCluster(null);
            }
        }

        /**
         * Zoom in
         */
        zoomIn() {
            this.viewport.scale = window.Utils.clamp(
                this.viewport.scale * this.zoomFactor,
                this.minScale,
                this.maxScale
            );
            this.invalidate({ basemap: true, overlay: true });
            this.updateZoomDisplay();

            // End interaction state shortly after wheel stops
            clearTimeout(this._interactionEndTimeout);
            this._interactionEndTimeout = setTimeout(() => {
                this.isInteracting = false;
                this.invalidate({ basemap: true, overlay: true });
            }, 120);
        }

        /**
         * Zoom out
         */
        zoomOut() {
            this.viewport.scale = window.Utils.clamp(
                this.viewport.scale / this.zoomFactor,
                this.minScale,
                this.maxScale
            );
            this.isInteracting = true;
            this.invalidate({ basemap: true, overlay: true });
            this.updateZoomDisplay();

            clearTimeout(this._interactionEndTimeout);
            this._interactionEndTimeout = setTimeout(() => {
                this.isInteracting = false;
                this.invalidate({ basemap: true, overlay: true });
            }, 120);
        }

        /**
         * Reset view to default
         */
        resetView() {
            this.viewport.centerLat = 39.8283;
            this.viewport.centerLng = -98.5795;
            this.viewport.scale = 0.00005;
            this.invalidate({ basemap: true, overlay: true });
            this.updateZoomDisplay();
        }

        /**
         * Fit view to data
         */
        fitToData() {
            // Collect all points
            const points = [];
            
            this.properties.forEach(p => {
                points.push({ lat: p.lat, lng: p.lng });
            });
            
            this.clusters.forEach(c => {
                if (c.center) {
                    points.push(c.center);
                }
                if (c.hull) {
                    c.hull.forEach(pt => points.push(pt));
                }
            });

            // Include rep home bases (so the rep map can auto-fit correctly)
            this.reps.forEach(r => {
                const lat = (r.homeLat !== undefined && r.homeLat !== null) ? parseFloat(r.homeLat) : null;
                const lng = (r.homeLng !== undefined && r.homeLng !== null) ? parseFloat(r.homeLng) : null;
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    points.push({ lat, lng });
                }
            });

            if (points.length === 0) {
                this.resetView();
                return;
            }

            const newViewport = window.Projection.fitToPoints(
                points,
                this.viewport.width,
                this.viewport.height,
                60
            );

            this.viewport.centerLat = newViewport.centerLat;
            this.viewport.centerLng = newViewport.centerLng;
            this.viewport.scale = newViewport.scale;

            this.invalidate({ basemap: true, overlay: true });
            this.updateZoomDisplay();
        }

        /**
         * Update zoom level display
         */
        updateZoomDisplay() {
            const zoomEl = document.getElementById('zoomLevel');
            if (zoomEl) {
                const EARTH_RADIUS = 6378137;
                const TILE_SIZE = 256;
                const z = Math.log2((this.viewport.scale * 2 * Math.PI * EARTH_RADIUS) / TILE_SIZE);
                const zoomLevel = (this.viewport.scale / 0.00005).toFixed(1);
                zoomEl.textContent = `z ${z.toFixed(1)} (${zoomLevel}x)`;
            }
            
            if (this.onZoomChange) {
                this.onZoomChange(this.viewport.scale);
            }
        }

        /**
         * Update points rendered display
         */
        updatePointsDisplay() {
            const renderedEl = document.getElementById('pointsRendered');
            const totalEl = document.getElementById('pointsTotal');
            
            if (renderedEl) {
                renderedEl.textContent = this.renderStats.rendered.toLocaleString();
            }
            if (totalEl) {
                totalEl.textContent = this.renderStats.total.toLocaleString();
            }
        }

        /**
         * Select a cluster
         */
        selectCluster(clusterId) {
            this.selectedClusterId = clusterId;
            this.invalidate({ overlay: true });
            
            if (this.onClusterSelect) {
                this.onClusterSelect(clusterId);
            }
        }

        /**
         * Set properties data
         */
        setProperties(properties) {
            this.properties = properties || [];
            this.invalidate({ overlay: true });
        }

        /**
         * Set clusters data
         */
        setClusters(clusters) {
            this.clusters = clusters || [];
            this.selectedClusterId = null;
            this.invalidate({ overlay: true });
        }

        /**
         * Set reps data
         */
        setReps(reps) {
            this.reps = reps || [];
            this.invalidate({ overlay: true });
        }

        /**
         * Schedule a render on the next animation frame.
         * @param {{basemap?: boolean, overlay?: boolean}} flags
         */
        invalidate(flags = {}) {
            if (!flags.basemap && !flags.overlay) {
                this._dirtyBasemap = true;
                this._dirtyOverlay = true;
            } else {
                if (flags.basemap) this._dirtyBasemap = true;
                if (flags.overlay) this._dirtyOverlay = true;
            }

            if (this._raf) return;
            this._raf = requestAnimationFrame(() => {
                this._raf = null;
                this.renderFrame();
            });
        }

        /**
         * Render the required layers.
         */
        renderFrame() {
            if (!this.ctx) return;

            // If no basemap canvas is present, render everything to the overlay canvas
            if (!this.basemapCanvas) {
                if (!this._dirtyBasemap && !this._dirtyOverlay) return;
                this._dirtyBasemap = false;
                this._dirtyOverlay = false;
                this.renderSingleCanvas();
                return;
            }

            if (this._dirtyBasemap) {
                this._dirtyBasemap = false;
                this.renderBasemap();
            }

            if (this._dirtyOverlay) {
                this._dirtyOverlay = false;
                this.renderOverlay();
            }
        }

        /**
         * Draw basemap layer (real tiles when available, otherwise procedural).
         */
        renderBasemap() {
            const { width, height } = this.viewport;
            this.baseCtx.clearRect(0, 0, width, height);
            window.Basemap.draw(this.baseCtx, this.viewport, { mode: 'auto' });
        }

        /**
         * Draw overlays (clusters, points, labels, reps).
         */
        renderOverlay() {
            const { width, height } = this.viewport;
            this.ctx.clearRect(0, 0, width, height);

            // Draw clusters if enabled
            if (this.options.showClusters && this.clusters.length > 0) {
                window.Overlay.drawClusters(
                    this.ctx,
                    this.viewport,
                    this.clusters,
                    this.selectedClusterId
                );
            }

            // Draw properties if enabled
            if (this.options.showProperties && this.properties.length > 0) {
                const maxPoints = this.isInteracting ? 2000 : 8000;
                this.renderStats = window.Overlay.drawProperties(
                    this.ctx,
                    this.viewport,
                    this.properties,
                    this.clusters,
                    this.selectedClusterId,
                    { maxPoints }
                );
                this.updatePointsDisplay();
            } else {
                this.renderStats = { rendered: 0, total: 0 };
                this.updatePointsDisplay();
            }

            // Draw cluster centers if enabled
            if (this.options.showClusters && this.clusters.length > 0) {
                window.Overlay.drawClusterCenters(
                    this.ctx,
                    this.viewport,
                    this.clusters,
                    this.selectedClusterId
                );
            }

            // Draw reps if enabled
            if (this.options.showReps && this.reps.length > 0) {
                window.Overlay.drawReps(this.ctx, this.viewport, this.reps);
            }
        }

        /**
         * Fallback: draw basemap and overlays to the same canvas.
         */
        renderSingleCanvas() {
            const { width, height } = this.viewport;
            this.ctx.clearRect(0, 0, width, height);
            window.Basemap.draw(this.ctx, this.viewport, { mode: 'auto' });

            if (this.options.showClusters && this.clusters.length > 0) {
                window.Overlay.drawClusters(this.ctx, this.viewport, this.clusters, this.selectedClusterId);
            }

            if (this.options.showProperties && this.properties.length > 0) {
                const maxPoints = this.isInteracting ? 2000 : 8000;
                this.renderStats = window.Overlay.drawProperties(
                    this.ctx,
                    this.viewport,
                    this.properties,
                    this.clusters,
                    this.selectedClusterId,
                    { maxPoints }
                );
                this.updatePointsDisplay();
            } else {
                this.renderStats = { rendered: 0, total: 0 };
                this.updatePointsDisplay();
            }

            if (this.options.showClusters && this.clusters.length > 0) {
                window.Overlay.drawClusterCenters(this.ctx, this.viewport, this.clusters, this.selectedClusterId);
            }

            if (this.options.showReps && this.reps.length > 0) {
                window.Overlay.drawReps(this.ctx, this.viewport, this.reps);
            }
        }

        /**
         * Destroy the map view
         */
        destroy() {
            window.removeEventListener('resize', this.resizeHandler);
            window.removeEventListener('basemap:tileLoaded', this._onTileLoaded);
            if (this._raf) {
                cancelAnimationFrame(this._raf);
                this._raf = null;
            }
            clearTimeout(this._interactionEndTimeout);
        }
    }

    // Expose to global scope
    global.MapView = MapView;

})(window);
