class MatrixView {
    constructor(containerEl) {
        this.container = containerEl;
        this.rawData = [];
        this.aggregatedData = null;
        this.sourceRegions = [];
        this.destRegions = [];
        this.filteredSources = [];
        this.filteredDests = [];
        this.sortMode = 'name';
        this.geoFilter = 'all';
        this.historyMap = new Map();
        this.latencyLookup = new Map();
        this._sourceSelection = null;
        this._destSelection = null;
        this._initialized = false;
        this._tooltipEl = null;
        this._sparklineEl = null;
        this._popover = null;
        document.addEventListener('pointerdown', event => {
            if (!event.target.closest('.matrix-cell, .matrix-col-header, .matrix-row-header')) {
                this._hideTooltip();
                this._hideSparkline();
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                this._hideTooltip();
                this._hideSparkline();
            }
        });
    }

    init(rawData, aggregatedData) {
        this._closePopover(false);
        this.rawData = rawData || [];
        this.aggregatedData = aggregatedData;
        if (!aggregatedData) return;
        this._buildHistoryMap();
        this.latencyLookup.clear();
        aggregatedData.connections.forEach(connection => {
            this.latencyLookup.set(`${connection.source}|${connection.destination}`, connection.latency);
        });
        this.sourceRegions = [...aggregatedData.regions].sort();
        this.destRegions = [...aggregatedData.regions].sort();
        if (!this._initialized) {
            this._readURLParams();
            this._initialized = true;
        }
        this._render();
    }

    _readURLParams() {
        const params = new URLSearchParams(window.location.search);
        this.geoFilter = GEO_GROUPS[params.get('mgeo')] ? params.get('mgeo') : 'all';
        this.sortMode = params.get('msort') === 'latency' ? 'latency' : 'name';
        this._sourceSelection = params.has('msrc') ? new Set(params.get('msrc').split(',').filter(region => this.sourceRegions.includes(region))) : null;
        this._destSelection = params.has('mdst') ? new Set(params.get('mdst').split(',').filter(region => this.destRegions.includes(region))) : null;
    }

    _syncURLParams() {
        const url = new URL(window.location);
        if (this.geoFilter !== 'all') url.searchParams.set('mgeo', this.geoFilter);
        else url.searchParams.delete('mgeo');
        if (this.sortMode !== 'name') url.searchParams.set('msort', this.sortMode);
        else url.searchParams.delete('msort');
        for (const [key, selection, regions] of [
            ['msrc', this._sourceSelection, this.sourceRegions],
            ['mdst', this._destSelection, this.destRegions]
        ]) {
            if (selection && selection.size !== regions.length) url.searchParams.set(key, [...selection].join(','));
            else url.searchParams.delete(key);
        }
        url.searchParams.set('view', 'matrix');
        history.replaceState(null, '', url);
    }

    show() {
        this.container.style.display = '';
        if (this.aggregatedData) {
            this._render();
            this._syncURLParams();
        }
    }

    hide() {
        this.container.style.display = 'none';
        this._closePopover(false);
        this._hideTooltip();
        this._hideSparkline();
    }

    _buildHistoryMap() {
        this.historyMap.clear();
        this.rawData.forEach(entity => {
            const latency = this._parseLatency(entity.latency);
            if (!entity.source || !entity.destination || latency === null || !Number.isFinite(Date.parse(entity.timestamp))) return;
            const key = `${entity.source}|${entity.destination}`;
            if (!this.historyMap.has(key)) this.historyMap.set(key, []);
            this.historyMap.get(key).push({ latency, timestamp: entity.timestamp });
        });
        this.historyMap.forEach(samples => samples.sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp)));
    }

    _parseLatency(value) {
        return LatencyMapApp.prototype.parseLatency(value);
    }

    _getLatency(source, destination) {
        return this.latencyLookup.get(`${source}|${destination}`) ?? null;
    }

    _getColor(latency) {
        if (latency === null) return '#f3f2f1';
        return LatencyMapApp.prototype.getLatencyColor(latency);
    }

    _getTextColor(latency) {
        if (latency === null) return '#605e5c';
        if (latency < 5) return '#ffffff';
        if (latency < 25) return '#443600';
        if (latency < 75) return '#4a2607';
        return '#ffffff';
    }

    _regionName(regionId) {
        return AZURE_REGIONS[regionId]?.displayName || regionId;
    }

    _regionInfo(regionId) {
        return AZURE_REGIONS[regionId] || null;
    }

    _geoGroupName(key) {
        return GEO_GROUPS[key]?.displayName || key;
    }

    _avgLatencyForRegion(regionId, peers) {
        const values = peers.filter(peer => peer !== regionId).map(peer => this._getLatency(regionId, peer)).filter(value => value !== null);
        return values.length ? values.reduce((total, value) => total + value, 0) / values.length : Infinity;
    }

    _avgLatencyToRegion(regionId, peers) {
        const values = peers.filter(peer => peer !== regionId).map(peer => this._getLatency(peer, regionId)).filter(value => value !== null);
        return values.length ? values.reduce((total, value) => total + value, 0) / values.length : Infinity;
    }

    _applyFilters() {
        let sources = [...this.sourceRegions];
        let destinations = [...this.destRegions];
        if (this.geoFilter !== 'all') {
            sources = sources.filter(region => this._regionInfo(region)?.geoGroup === this.geoFilter);
            destinations = destinations.filter(region => this._regionInfo(region)?.geoGroup === this.geoFilter);
        }
        if (this._sourceSelection) sources = sources.filter(region => this._sourceSelection.has(region));
        if (this._destSelection) destinations = destinations.filter(region => this._destSelection.has(region));
        if (this.sortMode === 'latency') {
            const sourceAverages = new Map(sources.map(region => [region, this._avgLatencyForRegion(region, destinations)]));
            const destinationAverages = new Map(destinations.map(region => [region, this._avgLatencyToRegion(region, sources)]));
            sources.sort((first, second) => sourceAverages.get(first) - sourceAverages.get(second));
            destinations.sort((first, second) => destinationAverages.get(first) - destinationAverages.get(second));
        } else {
            const compareNames = (first, second) => this._regionName(first).localeCompare(this._regionName(second));
            sources.sort(compareNames);
            destinations.sort(compareNames);
        }
        this.filteredSources = sources;
        this.filteredDests = destinations;
    }

    _render() {
        this._hideTooltip();
        this._hideSparkline();
        this._applyFilters();
        this.container.replaceChildren(this._buildToolbar(), this._buildMatrix());
        window.lucide?.createIcons();
    }

    _buildToolbar() {
        const toolbar = this._el('div');
        toolbar.className = 'matrix-toolbar';
        const geoLabel = this._el('label', 'Geography');
        geoLabel.className = 'matrix-toolbar-label';
        geoLabel.htmlFor = 'matrixGeo';
        const geoSelect = this._el('select');
        geoSelect.id = 'matrixGeo';
        geoSelect.className = 'matrix-select';
        for (const [key, name] of [['all', 'All geographies'], ...Object.entries(GEO_GROUPS).map(([key, group]) => [key, group.displayName])]) {
            const option = this._el('option', name);
            option.value = key;
            geoSelect.appendChild(option);
        }
        geoSelect.value = this.geoFilter;
        geoSelect.addEventListener('change', () => {
            this.geoFilter = geoSelect.value;
            this._syncURLParams();
            this._render();
        });
        toolbar.append(geoLabel, geoSelect);

        for (const type of ['source', 'dest']) {
            const button = this._el('button');
            button.id = type === 'source' ? 'matrixSources' : 'matrixDestinations';
            button.className = 'matrix-btn';
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-expanded', 'false');
            this._updateMultiSelectBtn(type, button);
            button.addEventListener('click', event => {
                event.stopPropagation();
                this._showMultiSelect(type, button);
            });
            toolbar.appendChild(button);
        }

        const sortLabel = this._el('label', 'Sort');
        sortLabel.className = 'matrix-toolbar-label';
        sortLabel.htmlFor = 'matrixSort';
        const sortSelect = this._el('select');
        sortSelect.id = 'matrixSort';
        sortSelect.className = 'matrix-select';
        sortSelect.innerHTML = '<option value="name">Name A-Z</option><option value="latency">Average latency</option>';
        sortSelect.value = this.sortMode;
        sortSelect.addEventListener('change', () => {
            this.sortMode = sortSelect.value;
            this._syncURLParams();
            this._render();
        });
        const legend = this._el('div');
        legend.className = 'matrix-legend';
        legend.appendChild(this._el('span', 'ONE-WAY / ms'));
        const bands = [
            [0, '< 5', 'Critical: RTT below 10 ms. High-frequency trading, cloud OLTP databases, Azure SQL, SAP HANA, in-memory caches.'],
            [5, '5-25', 'Real-time: RTT 10-50 ms. Cloud gaming, VR and AR streaming.'],
            [25, '25-75', 'Interactive: RTT 50-150 ms. Azure Virtual Desktop, Windows 365, SAP GUI, VoIP and video conferencing.'],
            [75, '75-200', 'Standard: RTT 150-400 ms. Web applications, SaaS, e-commerce, Microsoft 365 and REST APIs.'],
            [200, '200+', 'Async: RTT 400 ms or more. Backups, file sync, data warehouses, CI/CD, email and batch processing.']
        ];
        bands.forEach(([latency, label, title]) => {
            const item = this._el('span');
            item.className = 'matrix-legend-item';
            item.title = title;
            const swatch = this._el('b');
            swatch.style.background = this._getColor(latency);
            item.append(swatch, this._el('span', label));
            legend.appendChild(item);
        });
        const exportButton = this._el('button');
        exportButton.className = 'icon-btn';
        exportButton.setAttribute('aria-label', 'Export matrix as CSV');
        exportButton.dataset.tooltip = 'Export matrix';
        exportButton.innerHTML = '<i data-lucide="download"></i>';
        exportButton.disabled = !this.filteredSources.length || !this.filteredDests.length;
        exportButton.addEventListener('click', () => this._exportCSV());
        toolbar.append(sortLabel, sortSelect, legend, exportButton);
        return toolbar;
    }

    _buildMatrix() {
        const wrapper = this._el('div');
        wrapper.className = 'matrix-scroll';
        if (!this.filteredSources.length || !this.filteredDests.length) {
            const empty = this._el('div');
            empty.className = 'no-data';
            empty.innerHTML = '<i data-lucide="grid-3x3"></i><p>No regions match the current filters</p>';
            wrapper.appendChild(empty);
            return wrapper;
        }
        const table = this._el('table');
        table.className = 'matrix-table';
        table.setAttribute('aria-label', 'One-way latency in milliseconds, source rows to destination columns');
        const head = this._el('thead');
        const headerRow = this._el('tr');
        const corner = this._el('th', 'Source / Destination');
        corner.className = 'matrix-corner';
        corner.scope = 'col';
        headerRow.appendChild(corner);
        this.filteredDests.forEach(destination => {
            const header = this._el('th');
            header.className = 'matrix-col-header';
            header.scope = 'col';
            const text = this._el('div', this._regionName(destination));
            text.className = 'matrix-col-header-text';
            if (this._regionInfo(destination)) text.style.color = getRegionColor(this._regionInfo(destination));
            header.appendChild(text);
            this._bindRegionTooltip(header, destination);
            headerRow.appendChild(header);
        });
        head.appendChild(headerRow);
        table.appendChild(head);
        const body = this._el('tbody');
        let focusAssigned = false;
        this.filteredSources.forEach(source => {
            const row = this._el('tr');
            const rowHeader = this._el('th', this._regionName(source));
            rowHeader.className = 'matrix-row-header';
            rowHeader.scope = 'row';
            if (this._regionInfo(source)) rowHeader.style.color = getRegionColor(this._regionInfo(source));
            this._bindRegionTooltip(rowHeader, source);
            row.appendChild(rowHeader);
            this.filteredDests.forEach(destination => {
                const cell = this._el('td');
                const latency = this._getLatency(source, destination);
                cell.className = 'matrix-cell';
                cell.dataset.source = source;
                cell.dataset.destination = destination;
                cell.tabIndex = focusAssigned ? -1 : 0;
                focusAssigned = true;
                const measured = source !== destination && latency !== null;
                cell.style.background = this._getColor(measured ? latency : null);
                cell.style.color = this._getTextColor(measured ? latency : null);
                cell.textContent = measured ? latency.toFixed(1) : '\u2014';
                cell.setAttribute('aria-label', `${this._regionName(source)} to ${this._regionName(destination)}: ${measured ? `${latency.toFixed(2)} ms one-way` : source === destination ? 'same region' : 'no measurement'}`);
                if (measured) {
                    const show = event => this._showSparkline(source, destination, latency, event);
                    cell.addEventListener('mouseenter', show);
                    cell.addEventListener('focus', show);
                    cell.addEventListener('click', show);
                    cell.addEventListener('mouseleave', () => this._hideSparkline());
                    cell.addEventListener('blur', () => this._hideSparkline());
                }
                row.appendChild(cell);
            });
            body.appendChild(row);
        });
        table.appendChild(body);
        table.addEventListener('keydown', event => {
            const cell = event.target.closest('.matrix-cell');
            if (!cell || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const rowIndex = Math.max(1, Math.min(table.rows.length - 1, cell.parentElement.rowIndex + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
            let columnIndex = Math.max(1, Math.min(this.filteredDests.length, cell.cellIndex + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
            if (event.key === 'Home') columnIndex = 1;
            if (event.key === 'End') columnIndex = this.filteredDests.length;
            cell.tabIndex = -1;
            const target = table.rows[rowIndex].cells[columnIndex];
            target.tabIndex = 0;
            target.focus();
        });
        wrapper.addEventListener('scroll', () => {
            this._hideTooltip();
            this._hideSparkline();
        });
        wrapper.appendChild(table);
        return wrapper;
    }

    _bindRegionTooltip(element, regionId) {
        const info = this._regionInfo(regionId);
        if (info) element.setAttribute('aria-label', `${info.displayName}, ${info.country}, ${getRegionStatus(info)}`);
        element.addEventListener('mouseenter', event => this._showRegionTooltip(regionId, event));
        element.addEventListener('click', event => this._showRegionTooltip(regionId, event));
        element.addEventListener('mouseleave', () => this._hideTooltip());
    }

    _showRegionTooltip(regionId, event) {
        const info = this._regionInfo(regionId);
        if (!info) return;
        if (!this._tooltipEl) {
            this._tooltipEl = this._el('div');
            this._tooltipEl.className = 'matrix-tooltip';
            this._tooltipEl.setAttribute('role', 'tooltip');
            document.body.appendChild(this._tooltipEl);
        }
        this._tooltipEl.replaceChildren(
            this._el('strong', info.displayName),
            this._el('div', [info.city, info.country].filter(Boolean).join(', ')),
            this._el('div', this._geoGroupName(info.geoGroup)),
            this._el('div', `${getRegionStatus(info)} region`)
        );
        this._tooltipEl.style.display = 'block';
        this._positionFloating(this._tooltipEl, event);
    }

    _hideTooltip() {
        if (this._tooltipEl) this._tooltipEl.style.display = 'none';
    }

    _showSparkline(source, destination, latency, event) {
        if (!this._sparklineEl) {
            this._sparklineEl = this._el('div');
            this._sparklineEl.className = 'matrix-sparkline-popup';
            this._sparklineEl.setAttribute('role', 'tooltip');
            document.body.appendChild(this._sparklineEl);
        }
        const samples = this.historyMap.get(`${source}|${destination}`) || [];
        const title = this._el('div', `${this._regionName(source)} \u2192 ${this._regionName(destination)}`);
        title.className = 'sparkline-title';
        const value = this._el('div', `${latency.toFixed(2)} ms `);
        value.className = 'sparkline-value';
        value.appendChild(this._el('span', 'one-way'));
        this._sparklineEl.replaceChildren(title, value);
        if (samples.length > 1) {
            const canvas = this._el('canvas');
            canvas.id = 'matrix-sparkline-canvas';
            canvas.width = 280;
            canvas.height = 100;
            canvas.setAttribute('role', 'img');
            const values = samples.map(sample => sample.latency);
            canvas.setAttribute('aria-label', `${samples.length} measurements, from ${Math.min(...values).toFixed(2)} to ${Math.max(...values).toFixed(2)} milliseconds`);
            this._sparklineEl.appendChild(canvas);
            this._drawSparkline(canvas, samples);
        }
        const meta = this._el('div', samples.length ? `${samples.length} historical measurements` : 'No historical samples');
        meta.className = 'sparkline-meta';
        this._sparklineEl.appendChild(meta);
        this._sparklineEl.style.display = 'block';
        this._positionFloating(this._sparklineEl, event);
    }

    _hideSparkline() {
        if (this._sparklineEl) this._sparklineEl.style.display = 'none';
    }

    _positionFloating(element, event) {
        const anchor = event.currentTarget?.getBoundingClientRect();
        const pointerX = Number.isFinite(event.clientX) ? event.clientX : anchor?.left || 12;
        const pointerY = Number.isFinite(event.clientY) ? event.clientY : anchor?.bottom || 12;
        const left = Math.max(12, Math.min(pointerX + 12, window.innerWidth - element.offsetWidth - 12));
        const desiredTop = pointerY + element.offsetHeight + 24 > window.innerHeight ? pointerY - element.offsetHeight - 12 : pointerY + 12;
        const top = Math.max(12, Math.min(desiredTop, window.innerHeight - element.offsetHeight - 12));
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
    }

    _drawSparkline(canvas, samples) {
        const context = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const values = samples.map(sample => sample.latency);
        const maximum = Math.max(...values);
        const range = maximum || 1;
        const padding = { top: 8, right: 10, bottom: 20, left: 34 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const positionX = index => padding.left + index / (values.length - 1) * plotWidth;
        const positionY = value => padding.top + plotHeight - value / range * plotHeight;
        context.clearRect(0, 0, width, height);
        context.strokeStyle = '#e1dfdd';
        context.lineWidth = 1;
        context.fillStyle = '#605e5c';
        context.font = '9px monospace';
        context.textAlign = 'right';
        for (let index = 0; index <= 3; index++) {
            const vertical = padding.top + plotHeight / 3 * index;
            context.beginPath();
            context.moveTo(padding.left, vertical);
            context.lineTo(width - padding.right, vertical);
            context.stroke();
            context.fillText((maximum - maximum / 3 * index).toFixed(1), padding.left - 4, vertical + 3);
        }
        const dateLabel = timestamp => new Date(timestamp).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        context.textAlign = 'left';
        context.fillText(dateLabel(samples[0].timestamp), padding.left, height - 3);
        context.textAlign = 'right';
        context.fillText(dateLabel(samples[samples.length - 1].timestamp), width - padding.right, height - 3);
        context.beginPath();
        context.strokeStyle = '#0078d4';
        context.lineWidth = 1.5;
        context.lineJoin = 'round';
        values.forEach((value, index) => {
            if (index === 0) context.moveTo(positionX(index), positionY(value));
            else context.lineTo(positionX(index), positionY(value));
        });
        context.stroke();
        context.lineTo(positionX(values.length - 1), padding.top + plotHeight);
        context.lineTo(positionX(0), padding.top + plotHeight);
        context.closePath();
        context.fillStyle = '#0078d412';
        context.fill();
        context.fillStyle = '#0078d4';
        values.forEach((value, index) => {
            context.beginPath();
            context.arc(positionX(index), positionY(value), 1.5, 0, Math.PI * 2);
            context.fill();
        });
    }

    _showMultiSelect(type, anchorButton) {
        if (this._popover) {
            const sameType = this._popover.type === type;
            this._closePopover(true);
            if (sameType) return;
            anchorButton = document.getElementById(type === 'source' ? 'matrixSources' : 'matrixDestinations');
        }
        const regions = type === 'source' ? this.sourceRegions : this.destRegions;
        const selection = new Set((type === 'source' ? this._sourceSelection : this._destSelection) || regions);
        const popover = this._el('div');
        popover.className = 'matrix-multiselect-popover';
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-label', type === 'source' ? 'Filter source regions' : 'Filter destination regions');
        const search = this._el('input');
        search.type = 'search';
        search.className = 'matrix-search';
        search.placeholder = 'Search regions';
        search.setAttribute('aria-label', 'Search regions');
        const controls = this._el('div');
        controls.className = 'matrix-selection-controls';
        const allButton = this._el('button', 'Select all');
        allButton.className = 'matrix-btn';
        const noneButton = this._el('button', 'Clear');
        noneButton.className = 'matrix-btn';
        controls.append(allButton, noneButton);
        const list = this._el('div');
        list.className = 'matrix-multiselect-list';
        const renderList = () => {
            list.replaceChildren();
            const query = search.value.toLowerCase().trim();
            const matches = regions.filter(region => `${this._regionName(region)} ${region}`.toLowerCase().includes(query));
            matches.forEach(regionId => {
                const item = this._el('label');
                item.className = 'matrix-ms-item';
                const checkbox = this._el('input');
                checkbox.type = 'checkbox';
                checkbox.checked = selection.has(regionId);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) selection.add(regionId);
                    else selection.delete(regionId);
                });
                item.append(checkbox, this._el('span', this._regionName(regionId)));
                list.appendChild(item);
            });
            if (!matches.length) list.appendChild(this._el('p', 'No matching regions'));
        };
        search.addEventListener('input', renderList);
        allButton.addEventListener('click', () => {
            regions.forEach(region => selection.add(region));
            renderList();
        });
        noneButton.addEventListener('click', () => {
            selection.clear();
            renderList();
        });
        const applyButton = this._el('button', 'Apply filters');
        applyButton.className = 'matrix-btn matrix-btn-accent matrix-apply';
        applyButton.addEventListener('click', () => this._closePopover(true, true));
        popover.append(search, controls, list, applyButton);
        renderList();
        const outsideClick = event => {
            if (!popover.contains(event.target) && !anchorButton.contains(event.target)) this._closePopover(true);
        };
        popover.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                this._closePopover(false, true);
            }
            if (event.key === 'Tab' && event.shiftKey && document.activeElement === search) {
                event.preventDefault();
                applyButton.focus();
            } else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === applyButton) {
                event.preventDefault();
                search.focus();
            }
        });
        this._popover = { element: popover, type, selection, outsideClick, buttonId: anchorButton.id };
        anchorButton.setAttribute('aria-expanded', 'true');
        popover.style.position = 'fixed';
        popover.style.zIndex = '10000';
        document.body.appendChild(popover);
        const anchor = anchorButton.getBoundingClientRect();
        this._positionFloating(popover, { clientX: anchor.left - 12, clientY: anchor.bottom - 7 });
        document.addEventListener('click', outsideClick);
        search.focus({ preventScroll: true });
    }

    _closePopover(apply, restoreFocus = false) {
        if (!this._popover) return;
        const { element, type, selection, outsideClick, buttonId } = this._popover;
        document.removeEventListener('click', outsideClick);
        element.remove();
        this._popover = null;
        document.getElementById(buttonId)?.setAttribute('aria-expanded', 'false');
        if (apply) {
            const regions = type === 'source' ? this.sourceRegions : this.destRegions;
            this[type === 'source' ? '_sourceSelection' : '_destSelection'] = selection.size === regions.length ? null : selection;
            this._syncURLParams();
            this._render();
        }
        if (restoreFocus) document.getElementById(buttonId)?.focus();
    }

    _updateMultiSelectBtn(type, button) {
        const selection = type === 'source' ? this._sourceSelection : this._destSelection;
        const regions = type === 'source' ? this.sourceRegions : this.destRegions;
        button.textContent = `${type === 'source' ? 'Sources' : 'Destinations'} (${selection ? selection.size : regions.length}) `;
        const icon = this._el('i');
        icon.dataset.lucide = 'chevron-down';
        button.appendChild(icon);
    }

    _exportCSV() {
        const rows = [['Source \\ Destination', ...this.filteredDests.map(region => this._regionName(region))]];
        this.filteredSources.forEach(source => {
            const row = [this._regionName(source)];
            this.filteredDests.forEach(destination => {
                const latency = this._getLatency(source, destination);
                row.push(source === destination || latency === null ? '' : latency.toFixed(2));
            });
            rows.push(row);
        });
        downloadCSV(rows, `${window.app?.isDemo ? 'demo-' : ''}azure-latency-matrix.csv`);
        window.app?.showToast(`${this.filteredSources.length} x ${this.filteredDests.length} matrix exported`);
    }

    _el(tag, text) {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        return element;
    }
}