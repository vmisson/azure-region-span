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

/**
 * Color codes used to distinguish region types on the map.
 * - Green: recommended regions
 * - Orange: DR/restricted regions (access limited to disaster recovery scenarios)
 * - Blue: other regions
 * @type {Object.<string, string>}
 */
const REGION_TYPE_COLORS = {
    recommended: '#107c10',
    restricted: '#d83b01',
    other: '#0078d4'
};

/**
 * Returns the marker color for a region based on its type.
 * @param {{regionType: string}} region - Region metadata
 * @returns {string} Hex color code
 */
function getRegionColor(region) {
    return REGION_TYPE_COLORS[region.regionType] || REGION_TYPE_COLORS.other;
}

/**
 * Returns the human-readable status label for a region based on its type.
 * @param {{regionType: string}} region - Region metadata
 * @returns {string} Status label
 */
function getRegionStatus(region) {
    if (region.regionType === 'recommended') return 'Recommended';
    if (region.regionType === 'restricted') return 'Restricted';
    return 'Other';
}

function downloadCSV(rows, filename) {
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
        const localDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
        this.apiBaseUrl = window.LATENCY_API_BASE_URL || (localDevelopment ? '/api' : 'https://func-latency-api-001.azurewebsites.net/api');
        this.isDemo = false;
        this.visibleConnections = [];
        this.showConnections = true;
        this.sourceLabel = null;
        this.activeDestination = null;
        
        this.init();
    }

    /**
     * Initializes the application.
     * Sets up the map, markers, event bindings, and loads latency data.
     * @async
     */
    async init() {
        window.lucide?.createIcons();
        this.updateProgress(0, 'Initializing map...');
        this.initMap();
        
        this.updateProgress(20, 'Loading region markers...');
        this.initRegionMarkers();
        
        this.updateProgress(40, 'Setting up controls...');
        this.bindEvents();
        
        this.updateProgress(50, 'Fetching latency data...');
        await this.loadLatencyData();

        const params = new URLSearchParams(window.location.search);
        const source = params.has('source') ? params.get('source') : 'francecentral';
        if (AZURE_REGIONS[source]) this.selectRegion(source, false);
        else this.clearSelection();
        this.fitNetwork();
        const matrixRequested = params.get('view') === 'matrix' || ['mgeo', 'msort', 'msrc', 'mdst'].some(key => params.has(key));
        this.switchView(matrixRequested ? 'matrix' : 'map', false);
        
        this.updateProgress(100, 'Complete!');
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
    * Initializes the Leaflet map with a light geographic basemap.
     * Centers the map on the world view.
     */
    initMap() {
        this.map = L.map('map', {
            center: [24, 12],
            zoom: 2,
            minZoom: 0.5,
            maxZoom: 8,
            zoomSnap: 0.25,
            zoomDelta: 0.5,
            scrollWheelZoom: true,
            zoomControl: false,
            worldCopyJump: true
        });

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        this.map.createPane('connections').style.zIndex = '350';
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>, DeLorme, NAVTEQ',
            maxZoom: 16
        }).addTo(this.map);
    }

    fitNetwork() {
        this.map.invalidateSize();
        this.map.fitBounds(Object.values(AZURE_REGIONS).map(region => region.coordinates), {
            paddingTopLeft: [28, 40],
            paddingBottomRight: [28, 85],
            maxZoom: 3,
            animate: false
        });
    }

    /**
     * Creates circle markers for each Azure region on the map.
     * Markers are color-coded based on region type:
    * - Green (#107c10): Recommended regions
     * - Blue (#0078d4): Alternate regions
     */
    initRegionMarkers() {
        // Create markers for each Azure region
        // Green (#107c10) for recommended regions, Blue (#0078d4) for alternate regions
        Object.entries(AZURE_REGIONS).forEach(([regionId, region]) => {
            const markerColor = getRegionColor(region);
            const marker = L.circleMarker(region.coordinates, {
                radius: 5,
                fillColor: markerColor,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 1
            });

            const regionStatus = getRegionStatus(region);
            marker.bindTooltip(`${region.displayName}<br><span style="font-size: 0.8em; color: ${getRegionColor(region)}">${regionStatus}</span>`, {
                permanent: false,
                direction: 'top',
                offset: [0, -10]
            });

            marker.on('click', () => this.selectRegion(regionId));
            marker.addTo(this.map);
            const markerElement = marker.getElement();
            markerElement.setAttribute('tabindex', '0');
            markerElement.setAttribute('role', 'button');
            markerElement.setAttribute('aria-label', `Select ${region.displayName}`);
            markerElement.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    this.selectRegion(regionId);
                }
            });
            
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
            if (document.getElementById('sidebar').classList.contains('open')) this.setSidebarOpen(false);
        });

        // Initialize destination filter checkboxes
        this.initDestinationFilter();
        this.bindDashboardEvents();
        window.lucide?.createIcons();
    }

    bindDashboardEvents() {
        document.getElementById('mapViewBtn').addEventListener('click', () => this.switchView('map'));
        document.getElementById('matrixViewBtn').addEventListener('click', () => this.switchView('matrix'));
        document.querySelector('.view-toggle').addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const view = event.key === 'Home' ? 'map' : event.key === 'End' ? 'matrix' : document.body.dataset.view === 'map' ? 'matrix' : 'map';
            this.switchView(view);
            document.getElementById(`${view}ViewBtn`).focus();
        });
        document.getElementById('mapResetBtn').addEventListener('click', () => this.fitNetwork());
        document.getElementById('connectionsToggle').addEventListener('change', event => {
            this.showConnections = event.target.checked;
            this.refreshDisplay();
        });
        document.getElementById('regionSearch').addEventListener('input', event => {
            const query = event.target.value.toLowerCase().trim();
            document.querySelectorAll('.destination-checkbox-item').forEach(item => {
                item.hidden = !item.textContent.toLowerCase().includes(query) && !item.querySelector('input').value.includes(query);
            });
        });
        document.getElementById('routeSearch').addEventListener('input', () => this.refreshDisplay());
        document.getElementById('routeSort').addEventListener('change', () => this.refreshDisplay());
        document.getElementById('exportRoutesBtn').addEventListener('click', () => this.exportRoutes());
        document.getElementById('refreshBtn').addEventListener('click', async () => {
            const button = document.getElementById('refreshBtn');
            button.disabled = true;
            button.classList.add('is-refreshing');
            const url = new URL(window.location);
            url.searchParams.delete('demo');
            history.replaceState(null, '', url);
            await this.loadLatencyData();
            this.refreshDisplay();
            button.classList.remove('is-refreshing');
            button.disabled = false;
            this.showToast(this.loadError ? 'Could not refresh. Current data retained.' : 'Measurements refreshed');
        });
        document.getElementById('mobileMenuBtn').addEventListener('click', () => this.setSidebarOpen(true));
        document.getElementById('sidebarClose').addEventListener('click', () => this.setSidebarOpen(false));
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.setSidebarOpen(false));
        document.addEventListener('keydown', event => {
            const sidebar = document.getElementById('sidebar');
            if (!sidebar.classList.contains('open')) return;
            if (event.key === 'Escape') this.setSidebarOpen(false);
            if (event.key !== 'Tab') return;
            const focusable = [...sidebar.querySelectorAll('button, input, select, summary')].filter(element => element.offsetParent !== null);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === sidebar)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
        window.matchMedia('(max-width: 1023px)').addEventListener('change', () => this.setSidebarOpen(false, false));
        this.setSidebarOpen(false, false);
    }

    setSidebarOpen(open, restoreFocus = true) {
        const sidebar = document.getElementById('sidebar');
        const mobile = window.matchMedia('(max-width: 1023px)').matches;
        sidebar.classList.toggle('open', open);
        sidebar.inert = mobile && !open;
        document.getElementById('sidebarOverlay').classList.toggle('active', open);
        document.getElementById('mobileMenuBtn').setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) document.getElementById('sidebarClose').focus();
        else if (restoreFocus && mobile) document.getElementById('mobileMenuBtn').focus();
    }

    switchView(view, syncUrl = true) {
        const matrix = view === 'matrix';
        document.body.dataset.view = view;
        document.getElementById('mapWorkspace').hidden = matrix;
        document.getElementById('matrix').style.display = matrix ? '' : 'none';
        document.getElementById('pageTitle').firstChild.textContent = matrix ? 'Latency matrix' : 'Network map';
        ['map', 'matrix'].forEach(name => {
            const button = document.getElementById(`${name}ViewBtn`);
            button.classList.toggle('active', name === view);
            button.setAttribute('aria-selected', String(name === view));
            button.tabIndex = name === view ? 0 : -1;
        });
        if (matrix) window.matrixView?.show();
        else {
            window.matrixView?.hide();
            this.map.invalidateSize();
        }
        if (syncUrl) {
            const url = new URL(window.location);
            if (matrix) url.searchParams.set('view', 'matrix');
            else ['view', 'mgeo', 'msort', 'msrc', 'mdst'].forEach(key => url.searchParams.delete(key));
            history.replaceState(null, '', url);
        }
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
    }

    exportRoutes() {
        if (!this.visibleConnections.length) {
            this.showToast('No visible routes to export');
            return;
        }
        const rows = [['Source', 'Destination', 'Outbound (ms)', 'Inbound (ms)', 'RTT (ms)', 'Average one-way (ms)', 'Measurements', 'Data mode']];
        this.visibleConnections.forEach(connection => {
            rows.push([
                AZURE_REGIONS[this.selectedRegion]?.displayName || this.selectedRegion,
                AZURE_REGIONS[connection.destination]?.displayName || connection.destination,
                connection.forwardLatency?.toFixed(2), connection.reverseLatency?.toFixed(2),
                connection.rtt?.toFixed(2), connection.avgLatency?.toFixed(2),
                connection.forwardCount + connection.reverseCount, this.isDemo ? 'Demo' : 'Measured'
            ]);
        });
        downloadCSV(rows, `${this.isDemo ? 'demo-' : ''}azure-routes-${this.selectedRegion}.csv`);
        this.showToast(`${this.visibleConnections.length} routes exported`);
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
            toggleBtn.setAttribute('aria-expanded', String(checkboxContainer.classList.contains('open')));
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
            btn.setAttribute('role', 'checkbox');
            btn.setAttribute('aria-checked', 'true');
            btn.innerHTML = `
                <span class="geo-check" aria-hidden="true"><i data-lucide="check"></i></span>
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
            btn.setAttribute('aria-checked', someSelected ? 'mixed' : String(allSelected));
            
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
        this.updateSelectionDetails();
    }

    updateSelectionDetails() {
        const region = AZURE_REGIONS[this.selectedRegion];
        document.getElementById('sourceMeta').textContent = region ? [region.city, region.country].filter(Boolean).join(', ') : 'Global network';
        document.getElementById('routeSource').textContent = region?.displayName || 'No source selected';
        document.getElementById('mapRegionLabel').textContent = region ? `${region.displayName} / ${this.visibleConnections.length} destinations` : `${Object.keys(AZURE_REGIONS).length} Azure regions`;
        document.getElementById('mapCoordinates').textContent = region
            ? `${Math.abs(region.coordinates[0]).toFixed(2)} ${region.coordinates[0] >= 0 ? 'N' : 'S'} / ${Math.abs(region.coordinates[1]).toFixed(2)} ${region.coordinates[1] >= 0 ? 'E' : 'W'}`
            : 'GLOBAL NETWORK';
    }

    /**
     * Fetches and processes latency data from the API.
     * Falls back to demo data if the API is unavailable.
     * @async
     */
    async loadLatencyData() {
        this.loadError = null;
        try {
            this.updateProgress(55, 'Connecting to API...');
            if (new URLSearchParams(window.location.search).get('demo') === '1') {
                this.latencyData = this.generateDemoData();
                this.rawData = [];
                this.isDemo = true;
            } else {
                const response = await fetch(`${this.apiBaseUrl}/latency`, { signal: AbortSignal.timeout(20000) });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                this.updateProgress(70, 'Downloading latency data...');
                const rawData = await response.json();
                if (!Array.isArray(rawData)) throw new Error('Invalid measurement data');
                this.updateProgress(85, 'Processing data...');
                const aggregated = this.aggregateLatencyData(rawData);
                if (!aggregated.connections.length) throw new Error('No valid measurements');
                this.rawData = rawData;
                this.latencyData = aggregated;
                this.isDemo = false;
            }
        } catch (error) {
            this.loadError = error;
            if (!this.latencyData) {
                this.rawData = [];
                this.latencyData = this.generateDemoData();
                this.isDemo = true;
            }
        }
        this.updateProgress(95, 'Updating statistics...');
        this.updateDataStatus();
        this.updateStats();
        this.updateLastMeasurement();
        this.initMatrixView();
    }

    updateDataStatus() {
        document.getElementById('dataStatus').classList.toggle('demo', this.isDemo);
        document.getElementById('dataStatusText').textContent = this.isDemo ? 'Demo data' : this.loadError ? 'Saved measurements' : 'Measured data';
        const notice = document.getElementById('dataNotice');
        notice.hidden = !this.isDemo && !this.loadError;
        notice.textContent = this.isDemo
            ? `${this.loadError ? 'Live measurements are unavailable. ' : ''}Demo data: simulated latencies, not actual Azure measurements.`
            : this.loadError ? 'The API could not be reached. The last loaded measurements are still displayed.' : '';
    }

    /**
     * Initializes (or re-initializes) the MatrixView with current data.
     * Exposes it on window so the view-toggle script can show/hide it.
     */
    initMatrixView() {
        if (typeof MatrixView === 'undefined') return;
        const matrixEl = document.getElementById('matrix');
        if (!matrixEl) return;
        if (!window.matrixView) {
            window.matrixView = new MatrixView(matrixEl);
        }
        window.matrixView.init(this.rawData || [], this.latencyData);
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

            const latency = this.parseLatency(latencyRaw);
            if (typeof source === 'string' && source && typeof destination === 'string' && destination && latency !== null) {
                regions.add(source);
                regions.add(destination);

                const key = `${source}->${destination}`;
                const existing = latencyMap.get(key);

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
        if (typeof latencyStr === 'number') return Number.isFinite(latencyStr) && latencyStr >= 0 ? latencyStr : null;
        if (typeof latencyStr !== 'string') return null;
        const match = latencyStr.trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*(us|\u00b5s|\u03bcs|ms)?$/i);
        if (!match) return null;
        const value = Number(match[1]);
        const unit = match[2]?.toLowerCase();
        return unit && unit !== 'ms' ? value / 1000 : value;
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
                    
                    const seed = [...`${source}|${destination}`].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0);
                    const latency = (distance / 100) + (seed % 500) / 100 + 0.4;
                    
                    connections.push({
                        source,
                        destination,
                        latency: Math.round(latency * 100) / 100,
                        latencyRaw: `${Math.round(latency * 100) / 100} ms`,
                        timestamp: null,
                        measurementCount: 0
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
     * Updates the statistics panel.
     * When a region is selected, shows details and latency stats about that
     * region. Otherwise shows global statistics about the whole dataset.
     */
    updateStats() {
        if (!this.latencyData) return;
        const connections = this.latencyData.connections.filter(connection => Number.isFinite(connection.latency) && connection.source !== connection.destination);
        const fastest = connections.reduce((best, connection) => !best || connection.latency < best.latency ? connection : best, null);
        const average = connections.length ? connections.reduce((total, connection) => total + connection.latency, 0) / connections.length : null;
        const formatCount = value => value.toLocaleString('en-US');
        document.getElementById('metricRegions').textContent = formatCount(this.latencyData.regions.length);
        document.getElementById('metricCoverage').textContent = `${Object.keys(GEO_GROUPS).length} geographies / ${Object.keys(AZURE_REGIONS).length} mapped regions`;
        document.getElementById('metricConnections').textContent = formatCount(connections.length);
        document.getElementById('metricMeasurements').textContent = this.isDemo ? 'Simulated directional connections' : `${formatCount(this.rawData.length)} collected measurements`;
        document.getElementById('metricAverage').textContent = average?.toFixed(2) ?? '--';
        document.getElementById('metricFastest').textContent = fastest?.latency.toFixed(2) ?? '--';
        document.getElementById('metricFastestRoute').textContent = fastest ? `${AZURE_REGIONS[fastest.source]?.displayName || fastest.source} / ${AZURE_REGIONS[fastest.destination]?.displayName || fastest.destination}` : 'No measured connections';

        const titleEl = document.getElementById('statsTitle');
        const bodyEl = document.getElementById('statsBody');
        if (!titleEl || !bodyEl) return;

        if (this.selectedRegion && AZURE_REGIONS[this.selectedRegion]) {
            this.renderSelectedRegionStats(titleEl, bodyEl, this.selectedRegion);
        } else {
            this.renderGlobalStats(titleEl, bodyEl);
        }
    }

    /**
     * Builds a single statistics row.
     * @param {string} label - Row label
     * @param {string} value - Row value (HTML allowed)
     * @param {string} [color] - Optional value color
     * @returns {string} HTML string
     */
    statRow(label, value, color) {
        const style = color ? ` style="color: ${color}"` : '';
        return `<div class="stat-item"><span class="stat-label">${label}</span>` +
            `<span class="stat-value"${style}>${value}</span></div>`;
    }

    /**
     * Renders global dataset statistics into the stats panel.
     * @param {HTMLElement} titleEl - Panel title element
     * @param {HTMLElement} bodyEl - Panel body element
     */
    renderGlobalStats(titleEl, bodyEl) {
        const regionsCount = this.latencyData.regions ? this.latencyData.regions.length : Object.keys(AZURE_REGIONS).length;
        const connectionsCount = this.latencyData.connections ? this.latencyData.connections.length : 0;

        let avgLatency = 0;
        if (this.latencyData.connections && this.latencyData.connections.length > 0) {
            const totalLatency = this.latencyData.connections.reduce((sum, conn) => sum + (conn.latency || 0), 0);
            avgLatency = totalLatency / this.latencyData.connections.length;
        }

        titleEl.textContent = 'Statistics';
        bodyEl.innerHTML =
            this.statRow('Available Regions', regionsCount) +
            this.statRow('Measured Connections', connectionsCount) +
            this.statRow('Average Latency', `${avgLatency.toFixed(2)} ms`) +
            `<div class="stat-hint">Select a region on the map for details</div>`;
    }

    /**
     * Computes round-trip latency stats between a region and all its peers.
     * @param {string} regionId - Selected region ID
     * @returns {{peers: number, avgRtt: number|null, best: ?{id: string, rtt: number}, worst: ?{id: string, rtt: number}}}
     */
    computeRegionRttStats(regionId) {
        const result = { peers: 0, avgRtt: null, best: null, worst: null };
        if (!this.latencyData || !this.latencyData.connections) return result;

        const peerIds = new Set();
        this.latencyData.connections.forEach(conn => {
            if (conn.source === regionId && conn.destination !== regionId) peerIds.add(conn.destination);
            if (conn.destination === regionId && conn.source !== regionId) peerIds.add(conn.source);
        });

        let rttSum = 0;
        let rttCount = 0;
        peerIds.forEach(peerId => {
            const forward = this.latencyData.connections.find(c => c.source === regionId && c.destination === peerId);
            const reverse = this.latencyData.connections.find(c => c.source === peerId && c.destination === regionId);
            const f = forward?.latency;
            const r = reverse?.latency;
            if (f === null || f === undefined || r === null || r === undefined) return;

            const rtt = f + r;
            result.peers++;
            rttSum += rtt;
            rttCount++;
            if (!result.best || rtt < result.best.rtt) result.best = { id: peerId, rtt };
            if (!result.worst || rtt > result.worst.rtt) result.worst = { id: peerId, rtt };
        });

        if (rttCount > 0) result.avgRtt = rttSum / rttCount;
        return result;
    }

    /**
     * Renders details and latency stats about the selected region.
     * @param {HTMLElement} titleEl - Panel title element
     * @param {HTMLElement} bodyEl - Panel body element
     * @param {string} regionId - Selected region ID
     */
    renderSelectedRegionStats(titleEl, bodyEl, regionId) {
        const region = AZURE_REGIONS[regionId];
        const stats = this.computeRegionRttStats(regionId);

        const typeColor = getRegionColor(region);
        const typeLabel = getRegionStatus(region);
        const location = region.city ? `${region.city}, ${region.country}` : region.country;
        const geo = GEO_GROUPS[region.geoGroup]?.displayName || region.geoGroup;

        const peerName = (peer) => peer ? `${AZURE_REGIONS[peer.id]?.displayName || peer.id} (${peer.rtt.toFixed(2)} ms)` : 'N/A';

        titleEl.textContent = 'Selected Region';
        bodyEl.innerHTML =
            this.statRow('Region', region.displayName) +
            this.statRow('Type', typeLabel, typeColor) +
            this.statRow('Location', location) +
            this.statRow('Geography', geo) +
            this.statRow('Measured Peers', stats.peers) +
            this.statRow('Average RTT', stats.avgRtt !== null ? `${stats.avgRtt.toFixed(2)} ms` : 'N/A', this.getRttTextColor(stats.avgRtt)) +
            this.statRow('Fastest Peer', peerName(stats.best), this.getRttTextColor(stats.best?.rtt ?? null)) +
            this.statRow('Slowest Peer', peerName(stats.worst), this.getRttTextColor(stats.worst?.rtt ?? null));
    }

    /**
     * Updates the header indicator with the date of the most recent measurement.
     * Uses the latest timestamp found in the raw data (or aggregated connections).
     */
    updateLastMeasurement() {
        const valueEl = document.getElementById('lastMeasurementValue');
        if (!valueEl) return;
        document.getElementById('measurementLabel').textContent = this.isDemo ? 'Data source' : 'Latest measurement';
        if (this.isDemo) {
            valueEl.textContent = 'Synthetic dataset';
            document.getElementById('lastMeasurement').title = 'Distance-based simulation, not a real measurement';
            return;
        }

        let latest = null;
        const consider = (ts) => {
            if (!ts) return;
            const d = new Date(ts);
            if (isNaN(d.getTime())) return;
            if (!latest || d > latest) latest = d;
        };

        if (Array.isArray(this.rawData)) {
            this.rawData.forEach(e => consider(e.timestamp));
        }
        if (this.latencyData && Array.isArray(this.latencyData.connections)) {
            this.latencyData.connections.forEach(c => consider(c.timestamp));
        }

        if (!latest) {
            valueEl.textContent = 'N/A';
            return;
        }

        const formatted = latest.toLocaleString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        });
        valueEl.textContent = `${formatted} UTC`;
        const parent = valueEl.closest('.last-measurement');
        if (parent) parent.title = `Last measurement: ${latest.toLocaleString()}`;
    }

    /**
     * Selects a source region and displays its connections.
     * Clicking the same region again deselects it.
     * @param {string} regionId - Region identifier to select
     */
    selectRegion(regionId, recenter = true) {
        if (!regionId || !AZURE_REGIONS[regionId]) {
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
        this.activeDestination = null;
        this.sourceLabel?.remove();
        
        // Update dropdown
        document.getElementById('sourceRegion').value = regionId;

        // Reset all markers to their region type colors
        Object.entries(this.markers).forEach(([id, marker]) => {
            const region = AZURE_REGIONS[id];
            const defaultColor = getRegionColor(region);
            marker.setStyle({
                radius: 5,
                fillColor: defaultColor
            });
            marker.getElement().setAttribute('aria-pressed', String(id === regionId));
        });

        // Highlight selected marker (keep region type color, just increase size)
        if (this.markers[regionId]) {
            const region = AZURE_REGIONS[regionId];
            const selectedColor = getRegionColor(region);
            this.markers[regionId].setStyle({
                radius: 9,
                fillColor: selectedColor
            });

            if (recenter) this.map.panTo(region.coordinates, { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
            this.sourceLabel = L.tooltip({ permanent: true, direction: 'top', offset: [0, -12], className: 'source-tooltip' })
                .setLatLng(region.coordinates).setContent(region.displayName).addTo(this.map);
        }

        // Draw connections and update list
        this.drawConnections(regionId);
        this.updateLatencyList(regionId);
        this.updateStats();
        this.updateSelectionDetails();
        const url = new URL(window.location);
        url.searchParams.set('source', regionId);
        history.replaceState(null, '', url);
    }

    /**
     * Clears the current region selection.
     * Resets all markers and removes connection lines.
     */
    clearSelection() {
        this.selectedRegion = null;
        this.visibleConnections = [];
        this.activeDestination = null;
        this.sourceLabel?.remove();
        document.getElementById('sourceRegion').value = '';
        document.getElementById('routeCount').textContent = '0';
        
        // Reset all markers to their region type colors
        Object.entries(this.markers).forEach(([id, marker]) => {
            const region = AZURE_REGIONS[id];
            const defaultColor = getRegionColor(region);
            marker.setStyle({
                radius: 5,
                fillColor: defaultColor
            });
            marker.getElement().setAttribute('aria-pressed', 'false');
        });

        // Clear polylines
        this.clearPolylines();

        // Clear latency list
        document.getElementById('latencyList').innerHTML = `
            <div class="no-data"><i data-lucide="route"></i><p>No source selected</p></div>
        `;
        this.updateStats();
        this.updateSelectionDetails();
        const url = new URL(window.location);
        url.searchParams.set('source', '');
        history.replaceState(null, '', url);
        window.lucide?.createIcons();
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

        if (!this.latencyData || !this.latencyData.connections || !this.showConnections) return;

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
                    weight: 1.75,
                    opacity: 0.85,
                    dashArray: roundtripLatency === null ? '4 4' : null,
                    pane: 'connections'
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
                <div class="popup-rtt" style="color: ${this.getRttTextColor(roundtripLatency)}">RTT: ${roundtripStr}</div>
                <div class="popup-latency">Average (one-way): ${avgStr}</div>
                <div class="popup-route">${AZURE_REGIONS[sourceRegion].displayName} → ${peerRegion.displayName}: ${forwardStr}</div>
                <div class="popup-route">${peerRegion.displayName} → ${AZURE_REGIONS[sourceRegion].displayName}: ${reverseStr}</div>
                <div class="popup-measurements">${totalCount} measurements (${forwardCount} + ${reverseCount})</div>
            `);

            polyline.addTo(this.map);
            polyline.destination = peerRegionId;
            polyline.on('mouseover', () => polyline.setStyle({ weight: 3, opacity: 1 }));
            polyline.on('mouseout', () => polyline.setStyle({ weight: 1.75, opacity: 0.85 }));
            this.polylines.push(polyline);
        });
    }

    /**
     * Returns a color based on one-way latency value.
     * Aligned with matrix view bands.
     * @param {number|null} latency - Latency in milliseconds
     * @returns {string} Hex color code
     */
    getLatencyColor(latency) {
        return this.getRttColor(latency == null ? null : latency * 2);
    }

    /**
     * Returns a color based on round-trip time value.
     * Aligned with matrix view: one-way thresholds × 2 = RTT thresholds.
     * @param {number|null} rtt - RTT in milliseconds
     * @returns {string} Hex color code
     */
    getRttColor(rtt) {
        if (rtt === null || rtt === undefined) return '#8a8886';
        if (rtt < 10) return '#2e7d32';
        if (rtt < 50) return '#e8c547';
        if (rtt < 150) return '#e88b3a';
        if (rtt < 400) return '#cb4b3f';
        return '#7a2336';
    }

    getRttTextColor(rtt) {
        if (rtt === null || rtt === undefined) return '#605e5c';
        if (rtt < 10) return '#25662a';
        if (rtt < 50) return '#806000';
        if (rtt < 150) return '#a13a01';
        if (rtt < 400) return '#b13029';
        return '#7a2336';
    }

    /**
     * Returns a CSS class based on round-trip time value.
     * Aligned with matrix view bands (RTT = 2 × one-way).
     * @param {number|null} rtt - RTT in milliseconds
     * @returns {string} CSS class name (critical, realtime, interactive, standard, async)
     */
    getRttClass(rtt) {
        if (rtt === null || rtt === undefined) return '';
        if (rtt < 10)  return 'critical';
        if (rtt < 50)  return 'realtime';
        if (rtt < 150) return 'interactive';
        if (rtt < 400) return 'standard';
        return 'async';
    }

    /**
     * Returns a CSS class based on one-way latency value.
     * Aligned with matrix view bands.
     * @param {number|null} latency - Latency in milliseconds
     * @returns {string} CSS class name (critical, realtime, interactive, standard, async)
     */
    getLatencyClass(latency) {
        if (latency === null || latency === undefined) return '';
        if (latency < 5)   return 'critical';
        if (latency < 25)  return 'realtime';
        if (latency < 75)  return 'interactive';
        if (latency < 200) return 'standard';
        return 'async';
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
        const query = document.getElementById('routeSearch').value.toLowerCase().trim();
        const sortMode = document.getElementById('routeSort').value;
        const connections = Array.from(peerRegions).filter(regionId => {
            const region = AZURE_REGIONS[regionId];
            return `${region?.displayName || ''} ${region?.country || ''} ${regionId}`.toLowerCase().includes(query);
        }).map(peerRegionId => {
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
                rtt: forwardLatency != null && reverseLatency != null ? forwardLatency + reverseLatency : null,
                forwardCount: forwardConn?.measurementCount || 0,
                reverseCount: reverseConn?.measurementCount || 0
            };
        }).sort((first, second) => {
            if (sortMode === 'name') return (AZURE_REGIONS[first.destination]?.displayName || first.destination).localeCompare(AZURE_REGIONS[second.destination]?.displayName || second.destination);
            if (first.rtt === null) return second.rtt === null ? 0 : 1;
            if (second.rtt === null) return -1;
            return sortMode === 'latency-desc' ? second.rtt - first.rtt : first.rtt - second.rtt;
        });

        this.visibleConnections = connections;
        document.getElementById('routeCount').textContent = String(connections.length);

        if (connections.length === 0) {
            listContainer.innerHTML = `<div class="no-data"><i data-lucide="search-x"></i><p>${query ? 'No matching destinations' : this.selectedDestinations.size === 0 ? 'No destinations selected' : 'No measurements for this region'}</p></div>`;
            window.lucide?.createIcons();
            return;
        }

        const maxRtt = Math.max(...connections.map(connection => connection.rtt || 0), 1);
        listContainer.innerHTML = connections.map((conn, index) => {
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
                <button class="latency-item${this.activeDestination === conn.destination ? ' active' : ''}" data-destination="${conn.destination}" aria-expanded="${this.activeDestination === conn.destination}">
                    <span class="route-rank">${String(index + 1).padStart(2, '0')}</span>
                    <span class="route-info"><span class="destination">${displayName}</span><span class="route-country">${destRegion?.country || conn.destination}</span></span>
                    <span class="value ${rttClass}">${rttStr} <small>ms</small><span class="latency-bar"><b style="width:${rtt === null ? 0 : Math.max(4, rtt / maxRtt * 100)}%"></b></span></span>
                    <span class="latency-details"><span class="bidirectional-info">Out ${forwardStr} ms / In ${reverseStr} ms</span><span>Average ${avgStr} ms</span><span class="measurement-count">${this.isDemo ? 'Simulated connection' : `${totalCount} measurements`}</span></span>
                </button>
            `;
        }).join('');

        // Add click handlers to list items
        listContainer.querySelectorAll('.latency-item').forEach(item => {
            item.addEventListener('click', () => {
                const destination = item.dataset.destination;
                const destRegion = AZURE_REGIONS[destination];
                const expanded = this.activeDestination !== destination;
                this.activeDestination = expanded ? destination : null;
                listContainer.querySelectorAll('.latency-item').forEach(row => {
                    const active = row.dataset.destination === this.activeDestination;
                    row.classList.toggle('active', active);
                    row.setAttribute('aria-expanded', String(active));
                });
                if (!expanded) {
                    this.map.closePopup();
                    return;
                }
                if (destRegion) {
                    this.map.setView(destRegion.coordinates, Math.max(this.map.getZoom(), 3), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
                    const connection = this.polylines.find(line => line.destination === destination);
                    
                    if (connection) {
                        connection.openPopup(destRegion.coordinates);
                    }
                }
            });
            item.addEventListener('mouseenter', () => {
                this.polylines.forEach(line => line.setStyle({ weight: line.destination === item.dataset.destination ? 3 : 1.75, opacity: line.destination === item.dataset.destination ? 1 : 0.2 }));
            });
            item.addEventListener('mouseleave', () => {
                this.polylines.forEach(line => line.setStyle({ weight: 1.75, opacity: 0.85 }));
            });
        });
    }

    /**
     * Hides the loading overlay.
     */
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.body.classList.add('ready');
        window.lucide?.createIcons();
    }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LatencyMapApp();
});
