/**
 * Azure Region Latency Map Application
 * 
 * This application displays Azure region latencies on an interactive map.
 * It fetches latency data from an Azure Function API and visualizes
 * round-trip times (RTT) between Azure regions using color-coded polylines.
 * 
 * Features:
 * - Interactive world map with Azure region markers
 * - Color-coded latency visualization (green = low, red = high)
 * - Bidirectional latency measurements
 * - Geographic filtering by region groups
 * - Availability Zone status indicators
 * 
 * @author vmisson
 * @see https://github.com/vmisson/azure-region-span
 */

class LatencyMapApp {
    /**
     * Creates a new LatencyMapApp instance.
     * Initializes all properties and starts the application.
     */
    constructor() {
        /** @type {L.Map|null} Leaflet map instance */
        this.map = null;
        /** @type {Object.<string, L.CircleMarker>} Region markers indexed by region ID */
        this.markers = {};
        /** @type {L.Polyline[]} Active connection polylines */
        this.polylines = [];
        /** @type {Object|null} Aggregated latency data from API */
        this.latencyData = null;
        /** @type {string|null} Currently selected source region ID */
        this.selectedRegion = null;
        /** @type {Set<string>} Set of selected destination region IDs */
        this.selectedDestinations = new Set();
        /** @type {string} Base URL for the latency API */
        this.apiBaseUrl = 'https://func-latency-api-001.azurewebsites.net/api';
        
        this.init();
    }

    /**
     * Initializes the application.
     * Sets up the map, markers, event bindings, and loads latency data.
     * @async
     */
    async init() {
        this.updateProgress(0, 'Initializing map...');
        this.initMap();
        
        this.updateProgress(20, 'Loading region markers...');
        this.initRegionMarkers();
        
        this.updateProgress(40, 'Setting up controls...');
        this.bindEvents();
        
        this.updateProgress(50, 'Fetching latency data...');
        await this.loadLatencyData();
        
        this.updateProgress(100, 'Complete!');
        await this.delay(300);
        this.hideLoading();
    }

    /**
     * Creates a promise that resolves after a specified delay.
     * @param {number} ms - Delay in milliseconds
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Updates the loading progress indicator.
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} text - Status text to display
     */
    updateProgress(percent, text) {
        const progressBar = document.getElementById('progressBar');
        const loadingText = document.getElementById('loadingText');
        const loadingPercent = document.getElementById('loadingPercent');
        
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (loadingText) loadingText.textContent = text;
        if (loadingPercent) loadingPercent.textContent = `${percent}%`;
    }

    /**
     * Initializes the Leaflet map with dark theme tiles.
     * Centers the map on the world view.
     */
    initMap() {
        // Initialize the map centered on the world
        this.map = L.map('map', {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            maxZoom: 8,
            worldCopyJump: true
        });

        // Add dark theme tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);
    }

    /**
     * Creates circle markers for each Azure region on the map.
     * Markers are color-coded based on Availability Zone support:
     * - Green (#00ff88): Regions with Availability Zones
     * - Blue (#0078d4): Regions without Availability Zones
     */
    initRegionMarkers() {
        // Create markers for each Azure region
        // Green (#00ff88) for regions with Availability Zones, Blue (#0078d4) for regions without
        Object.entries(AZURE_REGIONS).forEach(([regionId, region]) => {
            const markerColor = region.hasAvailabilityZones ? '#00ff88' : '#0078d4';
            const marker = L.circleMarker(region.coordinates, {
                radius: 8,
                fillColor: markerColor,
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });

            const azStatus = region.hasAvailabilityZones ? '✓ Availability Zones' : '✗ No Availability Zones';
            marker.bindTooltip(`${region.displayName}<br><span style="font-size: 0.8em; color: ${region.hasAvailabilityZones ? '#00ff88' : '#94a3b8'}">${azStatus}</span>`, {
                permanent: false,
                direction: 'top',
                offset: [0, -10]
            });

            marker.on('click', () => this.selectRegion(regionId));
            marker.addTo(this.map);
            
            this.markers[regionId] = marker;
        });
    }

    /**
     * Binds event listeners to UI controls.
     * Sets up the region dropdown and initializes destination filters.
     */
    bindEvents() {
        const sourceSelect = document.getElementById('sourceRegion');
        
        // Populate the region dropdown
        Object.entries(AZURE_REGIONS)
            .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
            .forEach(([regionId, region]) => {
                const option = document.createElement('option');
                option.value = regionId;
                option.textContent = region.displayName;
                sourceSelect.appendChild(option);
            });

        sourceSelect.addEventListener('change', (e) => {
            this.selectRegion(e.target.value);
        });

        // Initialize destination filter checkboxes
        this.initDestinationFilter();
    }

    /**
     * Initializes the destination region filter UI.
     * Creates checkboxes for each region and sets up filter controls.
     */
    initDestinationFilter() {
        const checkboxContainer = document.getElementById('destinationCheckboxes');
        const geoFiltersContainer = document.getElementById('geoFilters');
        
        // Initialize geo filter buttons
        this.initGeoFilters(geoFiltersContainer);
        
        // Populate checkboxes for all regions, grouped by geo
        Object.entries(AZURE_REGIONS)
            .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
            .forEach(([regionId, region]) => {
                // Add to selected destinations by default
                this.selectedDestinations.add(regionId);
                
                const item = document.createElement('div');
                item.className = 'destination-checkbox-item';
                item.dataset.geoGroup = region.geoGroup;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `dest-${regionId}`;
                checkbox.value = regionId;
                checkbox.checked = true;
                
                const label = document.createElement('label');
                label.htmlFor = `dest-${regionId}`;
                label.textContent = region.displayName;
                
                item.appendChild(checkbox);
                item.appendChild(label);
                checkboxContainer.appendChild(item);
                
                // Event listener for checkbox
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.selectedDestinations.add(regionId);
                    } else {
                        this.selectedDestinations.delete(regionId);
                    }
                    this.updateFilterSummary();
                    this.updateGeoButtonStates();
                    this.refreshDisplay();
                });
            });

        // Select All button
        document.getElementById('selectAllDest').addEventListener('click', () => {
            this.selectedDestinations.clear();
            Object.keys(AZURE_REGIONS).forEach(regionId => {
                this.selectedDestinations.add(regionId);
            });
            checkboxContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
            });
            this.updateFilterSummary();
            this.updateGeoButtonStates();
            this.refreshDisplay();
        });

        // Clear All button
        document.getElementById('selectNoneDest').addEventListener('click', () => {
            this.selectedDestinations.clear();
            checkboxContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            this.updateFilterSummary();
            this.updateGeoButtonStates();
            this.refreshDisplay();
        });

        // Toggle for individual regions list
        const toggleBtn = document.getElementById('regionsListToggle');
        toggleBtn.addEventListener('click', () => {
            toggleBtn.classList.toggle('open');
            checkboxContainer.classList.toggle('open');
            const span = toggleBtn.querySelector('span');
            span.textContent = checkboxContainer.classList.contains('open') 
                ? 'Hide individual regions' 
                : 'Show individual regions';
        });

        this.updateFilterSummary();
    }

    /**
     * Initializes geographic group filter buttons.
     * @param {HTMLElement} container - Container element for the buttons
     */
    initGeoFilters(container) {
        // Count regions per geo group
        const geoCounts = {};
        Object.values(AZURE_REGIONS).forEach(region => {
            const geo = region.geoGroup;
            geoCounts[geo] = (geoCounts[geo] || 0) + 1;
        });

        // Create buttons for each geo group
        Object.entries(GEO_GROUPS).forEach(([geoId, geoInfo]) => {
            const count = geoCounts[geoId] || 0;
            if (count === 0) return; // Skip empty geo groups
            
            const btn = document.createElement('button');
            btn.className = 'geo-filter-btn active';
            btn.dataset.geo = geoId;
            btn.innerHTML = `
                <span class="geo-label">${geoInfo.displayName}</span>
                <span class="count">${count}</span>
            `;
            
            btn.addEventListener('click', () => {
                this.toggleGeoGroup(geoId);
            });
            
            container.appendChild(btn);
        });
    }

    /**
     * Toggles selection of all regions in a geographic group.
     * @param {string} geoId - Geographic group identifier
     */
    toggleGeoGroup(geoId) {
        const checkboxContainer = document.getElementById('destinationCheckboxes');
        const geoRegions = Object.entries(AZURE_REGIONS)
            .filter(([_, region]) => region.geoGroup === geoId)
            .map(([regionId, _]) => regionId);
        
        // Check if all regions in this geo group are currently selected
        const allSelected = geoRegions.every(regionId => this.selectedDestinations.has(regionId));
        
        if (allSelected) {
            // Deselect all in this geo group
            geoRegions.forEach(regionId => {
                this.selectedDestinations.delete(regionId);
                const checkbox = document.getElementById(`dest-${regionId}`);
                if (checkbox) checkbox.checked = false;
            });
        } else {
            // Select all in this geo group
            geoRegions.forEach(regionId => {
                this.selectedDestinations.add(regionId);
                const checkbox = document.getElementById(`dest-${regionId}`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        this.updateFilterSummary();
        this.updateGeoButtonStates();
        this.refreshDisplay();
    }

    /**
     * Updates the visual state of geographic filter buttons.
     * Sets 'active' class if all regions selected, 'partial' if some selected.
     */
    updateGeoButtonStates() {
        const geoButtons = document.querySelectorAll('.geo-filter-btn');
        
        geoButtons.forEach(btn => {
            const geoId = btn.dataset.geo;
            const geoRegions = Object.entries(AZURE_REGIONS)
                .filter(([_, region]) => region.geoGroup === geoId)
                .map(([regionId, _]) => regionId);
            
            const selectedCount = geoRegions.filter(regionId => this.selectedDestinations.has(regionId)).length;
            const allSelected = selectedCount === geoRegions.length;
            const someSelected = selectedCount > 0 && selectedCount < geoRegions.length;
            
            btn.classList.remove('active', 'partial');
            if (allSelected) {
                btn.classList.add('active');
            } else if (someSelected) {
                btn.classList.add('partial');
            }
        });
    }

    /**
     * Updates the filter summary text showing selected region count.
     */
    updateFilterSummary() {
        const summary = document.getElementById('filterSummary');
        const total = Object.keys(AZURE_REGIONS).length;
        const selected = this.selectedDestinations.size;
        
        if (selected === total) {
            summary.textContent = 'All regions selected';
        } else if (selected === 0) {
            summary.textContent = 'No regions selected';
        } else {
            summary.textContent = `${selected} of ${total} regions selected`;
        }
    }

    /**
     * Refreshes the map display with current filter settings.
     * Redraws connections and updates the latency list.
     */
    refreshDisplay() {
        if (this.selectedRegion) {
            this.drawConnections(this.selectedRegion);
            this.updateLatencyList(this.selectedRegion);
        }
    }

    /**
     * Fetches and processes latency data from the API.
     * Falls back to demo data if the API is unavailable.
     * @async
     */
    async loadLatencyData() {
        try {
            this.updateProgress(55, 'Connecting to API...');
            // Fetch raw latency data (all measurements)
            const response = await fetch(`${this.apiBaseUrl}/latency`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.updateProgress(70, 'Downloading latency data...');
            const rawData = await response.json();
            
            this.updateProgress(85, 'Processing data...');
            // Aggregate the data: keep latest measurement and count per connection
            this.latencyData = this.aggregateLatencyData(rawData);
            
            this.updateProgress(95, 'Updating statistics...');
            this.updateStats();
        } catch (error) {
            console.error('Error loading latency data:', error);
            this.updateProgress(80, 'Using demo data...');
            // Use demo data if API is not available
            this.latencyData = this.generateDemoData();
            this.updateStats();
        }
    }

    /**
     * Aggregates raw latency measurements into a structured format.
     * Keeps only the latest measurement per connection and counts total measurements.
     * @param {Array} rawData - Raw latency measurements from API
     * @returns {{regions: string[], connections: Object[]}} Aggregated data
     */
    aggregateLatencyData(rawData) {
        const latencyMap = new Map();
        const regions = new Set();

        rawData.forEach(entity => {
            const source = entity.source;
            const destination = entity.destination;
            const latencyRaw = entity.latency;
            const timestamp = entity.timestamp;

            if (source && destination && latencyRaw) {
                regions.add(source);
                regions.add(destination);

                const key = `${source}->${destination}`;
                const existing = latencyMap.get(key);
                const latency = this.parseLatency(latencyRaw);

                if (!existing) {
                    // First measurement for this connection
                    latencyMap.set(key, {
                        source,
                        destination,
                        latency,
                        latencyRaw,
                        timestamp,
                        measurementCount: 1
                    });
                } else {
                    // Increment measurement count
                    existing.measurementCount++;
                    // Keep only the latest measurement
                    if (new Date(timestamp) > new Date(existing.timestamp)) {
                        existing.latency = latency;
                        existing.latencyRaw = latencyRaw;
                        existing.timestamp = timestamp;
                    }
                }
            }
        });

        return {
            regions: Array.from(regions).sort(),
            connections: Array.from(latencyMap.values())
        };
    }

    /**
     * Parses a latency string into milliseconds.
     * Handles both 'ms' and 'us' (microseconds) units.
     * @param {string} latencyStr - Latency string (e.g., "10.5 ms" or "500 us")
     * @returns {number|null} Latency in milliseconds, or null if invalid
     */
    parseLatency(latencyStr) {
        if (!latencyStr) return null;
        
        const match = latencyStr.match(/([0-9.]+)\s*(us|ms)/);
        if (!match) {
            // Try parsing as plain number
            const num = parseFloat(latencyStr);
            return isNaN(num) ? null : num;
        }
        
        const value = parseFloat(match[1]);
        const unit = match[2];
        
        if (unit === 'us') {
            return value / 1000; // Convert microseconds to milliseconds
        }
        return value; // Already in milliseconds
    }

    /**
     * Generates demo latency data for testing when API is unavailable.
     * Calculates approximate latencies based on geographic distance.
     * @returns {{regions: string[], connections: Object[]}} Demo data
     */
    generateDemoData() {
        // Generate demo data for testing when API is not available
        const regions = Object.keys(AZURE_REGIONS);
        const connections = [];

        regions.forEach(source => {
            regions.forEach(destination => {
                if (source !== destination) {
                    // Calculate approximate latency based on distance
                    const sourceCoords = AZURE_REGIONS[source].coordinates;
                    const destCoords = AZURE_REGIONS[destination].coordinates;
                    const distance = this.calculateDistance(
                        sourceCoords[0], sourceCoords[1],
                        destCoords[0], destCoords[1]
                    );
                    
                    // Approximate latency: ~1ms per 100km + some randomness
                    const latency = (distance / 100) + (Math.random() * 10);
                    
                    connections.push({
                        source,
                        destination,
                        latency: Math.round(latency * 100) / 100,
                        latencyRaw: `${Math.round(latency * 100) / 100} ms`,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        });

        return {
            regions,
            connections
        };
    }

    /**
     * Calculates the great-circle distance between two coordinates.
     * Uses the Haversine formula.
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} Distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula to calculate distance in km
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Converts degrees to radians.
     * @param {number} deg - Angle in degrees
     * @returns {number} Angle in radians
     */
    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    /**
     * Updates the statistics panel with current data.
     * Shows region count, connection count, and average latency.
     */
    updateStats() {
        if (!this.latencyData) return;

        const regionsCount = this.latencyData.regions ? this.latencyData.regions.length : Object.keys(AZURE_REGIONS).length;
        const connectionsCount = this.latencyData.connections ? this.latencyData.connections.length : 0;
        
        let avgLatency = 0;
        if (this.latencyData.connections && this.latencyData.connections.length > 0) {
            const totalLatency = this.latencyData.connections.reduce((sum, conn) => sum + (conn.latency || 0), 0);
            avgLatency = totalLatency / this.latencyData.connections.length;
        }

        document.getElementById('statRegions').textContent = regionsCount;
        document.getElementById('statConnections').textContent = connectionsCount;
        document.getElementById('statAvgLatency').textContent = `${avgLatency.toFixed(2)} ms`;
    }

    /**
     * Selects a source region and displays its connections.
     * Clicking the same region again deselects it.
     * @param {string} regionId - Region identifier to select
     */
    selectRegion(regionId) {
        if (!regionId) {
            this.clearSelection();
            return;
        }

        // If clicking on the same region, deselect it
        if (this.selectedRegion === regionId) {
            this.clearSelection();
            document.getElementById('sourceRegion').value = '';
            return;
        }

        this.selectedRegion = regionId;
        
        // Update dropdown
        document.getElementById('sourceRegion').value = regionId;

        // Reset all markers to their AZ-based colors
        Object.entries(this.markers).forEach(([id, marker]) => {
            const region = AZURE_REGIONS[id];
            const defaultColor = region.hasAvailabilityZones ? '#00ff88' : '#0078d4';
            marker.setStyle({
                radius: 8,
                fillColor: defaultColor
            });
        });

        // Highlight selected marker (keep AZ color, just increase size)
        if (this.markers[regionId]) {
            const region = AZURE_REGIONS[regionId];
            const selectedColor = region.hasAvailabilityZones ? '#00ff88' : '#0078d4';
            this.markers[regionId].setStyle({
                radius: 12,
                fillColor: selectedColor
            });

            // Center map on selected region
            this.map.setView(region.coordinates, 3, { animate: true });
        }

        // Draw connections and update list
        this.drawConnections(regionId);
        this.updateLatencyList(regionId);
    }

    /**
     * Clears the current region selection.
     * Resets all markers and removes connection lines.
     */
    clearSelection() {
        this.selectedRegion = null;
        
        // Reset all markers to their AZ-based colors
        Object.entries(this.markers).forEach(([id, marker]) => {
            const region = AZURE_REGIONS[id];
            const defaultColor = region.hasAvailabilityZones ? '#00ff88' : '#0078d4';
            marker.setStyle({
                radius: 8,
                fillColor: defaultColor
            });
        });

        // Clear polylines
        this.clearPolylines();

        // Clear latency list
        document.getElementById('latencyList').innerHTML = `
            <div class="no-data">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <p>Select a source region to view latencies</p>
            </div>
        `;
    }

    /**
     * Removes all connection polylines from the map.
     */
    clearPolylines() {
        this.polylines.forEach(line => this.map.removeLayer(line));
        this.polylines = [];
    }

    /**
     * Draws connection lines from the source region to all destinations.
     * Lines are color-coded based on RTT values.
     * @param {string} sourceRegion - Source region identifier
     */
    drawConnections(sourceRegion) {
        this.clearPolylines();

        if (!this.latencyData || !this.latencyData.connections) return;

        const sourceCoords = AZURE_REGIONS[sourceRegion]?.coordinates;
        if (!sourceCoords) return;

        // Find all unique peer regions (where selected region is source OR destination)
        // AND filter by selected destinations
        const peerRegions = new Set();
        this.latencyData.connections.forEach(conn => {
            if (conn.source === sourceRegion && conn.destination !== sourceRegion) {
                if (this.selectedDestinations.has(conn.destination)) {
                    peerRegions.add(conn.destination);
                }
            }
            if (conn.destination === sourceRegion && conn.source !== sourceRegion) {
                if (this.selectedDestinations.has(conn.source)) {
                    peerRegions.add(conn.source);
                }
            }
        });

        peerRegions.forEach(peerRegionId => {
            const peerRegion = AZURE_REGIONS[peerRegionId];
            if (!peerRegion) return;

            // Find forward connection (selected -> peer)
            const forwardConn = this.latencyData.connections.find(
                c => c.source === sourceRegion && c.destination === peerRegionId
            );
            // Find reverse connection (peer -> selected)
            const reverseConn = this.latencyData.connections.find(
                c => c.source === peerRegionId && c.destination === sourceRegion
            );

            // Calculate average latency
            const forwardLatency = forwardConn?.latency;
            const reverseLatency = reverseConn?.latency;
            let avgLatency = null;
            if (forwardLatency !== null && forwardLatency !== undefined && reverseLatency !== null && reverseLatency !== undefined) {
                avgLatency = (forwardLatency + reverseLatency) / 2;
            } else if (forwardLatency !== null && forwardLatency !== undefined) {
                avgLatency = forwardLatency;
            } else if (reverseLatency !== null && reverseLatency !== undefined) {
                avgLatency = reverseLatency;
            }

            // Calculate roundtrip (sum of forward + reverse latencies)
            let roundtripLatency = null;
            if (forwardLatency !== null && forwardLatency !== undefined && reverseLatency !== null && reverseLatency !== undefined) {
                roundtripLatency = forwardLatency + reverseLatency;
            }

            const color = this.getRttColor(roundtripLatency);
            
            const polyline = L.polyline(
                [sourceCoords, peerRegion.coordinates],
                {
                    color: color,
                    weight: 3,
                    opacity: 0.7,
                    dashArray: null
                }
            );

            const forwardStr = forwardLatency !== null && forwardLatency !== undefined ? `${forwardLatency.toFixed(2)} ms` : 'N/A';
            const reverseStr = reverseLatency !== null && reverseLatency !== undefined ? `${reverseLatency.toFixed(2)} ms` : 'N/A';
            const avgStr = avgLatency !== null ? `${avgLatency.toFixed(2)} ms` : 'N/A';
            const roundtripStr = roundtripLatency !== null ? `${roundtripLatency.toFixed(2)} ms` : 'N/A';
            
            // Get measurement counts
            const forwardCount = forwardConn?.measurementCount || 0;
            const reverseCount = reverseConn?.measurementCount || 0;
            const totalCount = forwardCount + reverseCount;

            polyline.bindPopup(`
                <div class="popup-title">${AZURE_REGIONS[sourceRegion].displayName} ↔ ${peerRegion.displayName}</div>
                <div class="popup-rtt" style="color: ${color}">RTT: ${roundtripStr}</div>
                <div class="popup-latency">Average (one-way): ${avgStr}</div>
                <div class="popup-route">${AZURE_REGIONS[sourceRegion].displayName} → ${peerRegion.displayName}: ${forwardStr}</div>
                <div class="popup-route">${peerRegion.displayName} → ${AZURE_REGIONS[sourceRegion].displayName}: ${reverseStr}</div>
                <div class="popup-measurements">${totalCount} measurements (${forwardCount} + ${reverseCount})</div>
            `);

            polyline.addTo(this.map);
            this.polylines.push(polyline);
        });
    }

    /**
     * Returns a color based on one-way latency value.
     * @param {number|null} latency - Latency in milliseconds
     * @returns {string} Hex color code
     */
    getLatencyColor(latency) {
        if (latency === null || latency === undefined) return '#666666';
        if (latency < 10) return '#00ff88';   // Excellent
        if (latency < 30) return '#88ff00';   // Good
        if (latency < 80) return '#ffdd00';   // Fair
        if (latency < 150) return '#ff8800';  // Poor
        return '#ff4444';                      // Bad
    }

    /**
     * Returns a color based on round-trip time value.
     * @param {number|null} rtt - RTT in milliseconds
     * @returns {string} Hex color code
     */
    getRttColor(rtt) {
        if (rtt === null || rtt === undefined) return '#666666';
        if (rtt < 20) return '#00ff88';   // Excellent
        if (rtt < 60) return '#88ff00';   // Good
        if (rtt < 160) return '#ffdd00';  // Fair
        if (rtt < 300) return '#ff8800';  // High
        return '#ff4444';                  // Very High
    }

    /**
     * Returns a CSS class based on round-trip time value.
     * @param {number|null} rtt - RTT in milliseconds
     * @returns {string} CSS class name (excellent, good, fair, poor, bad)
     */
    getRttClass(rtt) {
        if (rtt === null || rtt === undefined) return '';
        if (rtt < 20) return 'excellent';
        if (rtt < 60) return 'good';
        if (rtt < 160) return 'fair';
        if (rtt < 300) return 'poor';
        return 'bad';
    }

    /**
     * Returns a CSS class based on one-way latency value.
     * @param {number|null} latency - Latency in milliseconds
     * @returns {string} CSS class name (excellent, good, fair, poor, bad)
     */
    getLatencyClass(latency) {
        if (latency === null || latency === undefined) return '';
        if (latency < 10) return 'excellent';
        if (latency < 30) return 'good';
        if (latency < 80) return 'fair';
        if (latency < 150) return 'poor';
        return 'bad';
    }

    /**
     * Updates the latency list sidebar with connections from the source region.
     * Shows bidirectional latency data and measurement counts.
     * @param {string} sourceRegion - Source region identifier
     */
    updateLatencyList(sourceRegion) {
        const listContainer = document.getElementById('latencyList');
        
        if (!this.latencyData || !this.latencyData.connections) {
            listContainer.innerHTML = '<div class="no-data"><p>No data available</p></div>';
            return;
        }

        // Find all unique peer regions (where selected region is source OR destination)
        // AND filter by selected destinations
        const peerRegions = new Set();
        this.latencyData.connections.forEach(conn => {
            if (conn.source === sourceRegion && conn.destination !== sourceRegion) {
                if (this.selectedDestinations.has(conn.destination)) {
                    peerRegions.add(conn.destination);
                }
            }
            if (conn.destination === sourceRegion && conn.source !== sourceRegion) {
                if (this.selectedDestinations.has(conn.source)) {
                    peerRegions.add(conn.source);
                }
            }
        });

        // Build connections list with bidirectional data
        const connections = Array.from(peerRegions).map(peerRegionId => {
            // Find forward connection (selected -> peer)
            const forwardConn = this.latencyData.connections.find(
                c => c.source === sourceRegion && c.destination === peerRegionId
            );
            // Find reverse connection (peer -> selected)
            const reverseConn = this.latencyData.connections.find(
                c => c.source === peerRegionId && c.destination === sourceRegion
            );
            
            const forwardLatency = forwardConn?.latency;
            const reverseLatency = reverseConn?.latency;
            let avgLatency = null;
            
            if (forwardLatency !== null && forwardLatency !== undefined && reverseLatency !== null && reverseLatency !== undefined) {
                avgLatency = (forwardLatency + reverseLatency) / 2;
            } else if (forwardLatency !== null && forwardLatency !== undefined) {
                avgLatency = forwardLatency;
            } else if (reverseLatency !== null && reverseLatency !== undefined) {
                avgLatency = reverseLatency;
            }
            
            return {
                destination: peerRegionId,
                forwardLatency,
                reverseLatency,
                avgLatency,
                forwardCount: forwardConn?.measurementCount || 0,
                reverseCount: reverseConn?.measurementCount || 0
            };
        }).sort((a, b) => (a.avgLatency || 999) - (b.avgLatency || 999));

        if (connections.length === 0) {
            listContainer.innerHTML = '<div class="no-data"><p>No measurements available for this region</p></div>';
            return;
        }

        listContainer.innerHTML = connections.map(conn => {
            const destRegion = AZURE_REGIONS[conn.destination];
            const displayName = destRegion?.displayName || conn.destination;
            
            // Calculate RTT
            let rtt = null;
            if (conn.forwardLatency !== null && conn.forwardLatency !== undefined && 
                conn.reverseLatency !== null && conn.reverseLatency !== undefined) {
                rtt = conn.forwardLatency + conn.reverseLatency;
            }
            const rttClass = this.getRttClass(rtt);
            const rttStr = rtt !== null ? `${rtt.toFixed(2)}` : 'N/A';
            
            const forwardStr = conn.forwardLatency !== null && conn.forwardLatency !== undefined ? `${conn.forwardLatency.toFixed(2)}` : 'N/A';
            const reverseStr = conn.reverseLatency !== null && conn.reverseLatency !== undefined ? `${conn.reverseLatency.toFixed(2)}` : 'N/A';
            const avgStr = conn.avgLatency !== null ? `${conn.avgLatency.toFixed(2)}` : 'N/A';
            const totalCount = conn.forwardCount + conn.reverseCount;
            
            return `
                <div class="latency-item" data-destination="${conn.destination}">
                    <div class="destination">${displayName}</div>
                    <div class="latency-details">
                        <div class="value ${rttClass}">${rttStr} ms RTT</div>
                        <div class="bidirectional-info">Avg: ${avgStr} ms | ↗ ${forwardStr} ms | ↙ ${reverseStr} ms</div>
                        <div class="measurement-count">${totalCount} measurements</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers to list items
        listContainer.querySelectorAll('.latency-item').forEach(item => {
            item.addEventListener('click', () => {
                const destination = item.dataset.destination;
                const destRegion = AZURE_REGIONS[destination];
                if (destRegion) {
                    this.map.setView(destRegion.coordinates, 4, { animate: true });
                    
                    // Find and open the popup for this connection
                    const connection = this.polylines.find(line => {
                        const latlngs = line.getLatLngs();
                        return latlngs[1].lat === destRegion.coordinates[0] &&
                               latlngs[1].lng === destRegion.coordinates[1];
                    });
                    
                    if (connection) {
                        connection.openPopup();
                    }
                }
            });
        });
    }

    /**
     * Hides the loading overlay.
     */
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LatencyMapApp();
});
