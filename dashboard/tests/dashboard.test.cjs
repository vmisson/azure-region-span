const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const frontend = join(__dirname, '../www');
const context = vm.createContext({
    console, URL, URLSearchParams,
    document: { addEventListener() {} },
    window: { location: new URL('http://localhost:8080/') },
    history: { replaceState(data, title, url) { context.window.location = new URL(url); } }
});
vm.runInContext(readFileSync(join(frontend, 'regions.js'), 'utf8'), context);
vm.runInContext(readFileSync(join(frontend, 'app.js'), 'utf8'), context);
vm.runInContext(readFileSync(join(frontend, 'matrix.js'), 'utf8'), context);
const App = vm.runInContext('LatencyMapApp', context);
const Matrix = vm.runInContext('MatrixView', context);

test('the HTML preserves all static application anchors without duplicate IDs', () => {
    const html = readFileSync(join(frontend, 'index.html'), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size);
    assert.match(html, /id="mapViewBtn"[^>]*><i[^>]*><\/i><span>Map<\/span>/);
    assert.match(html, /id="matrixViewBtn"[^>]*><i[^>]*><\/i><span>Matrix<\/span>/);
    const source = readFileSync(join(frontend, 'app.js'), 'utf8');
    for (const match of source.matchAll(/getElementById\('([^']+)'\)/g)) {
        assert(ids.includes(match[1]), `Missing element: ${match[1]}`);
    }
});

test('map enables mouse-wheel zoom while retaining its zoom buttons', () => {
    const app = Object.create(App.prototype);
    const map = { createPane: () => ({ style: {} }) };
    let mapOptions;
    let controlPosition;
    context.L = {
        map: (id, options) => {
            assert.equal(id, 'map');
            mapOptions = options;
            return map;
        },
        control: { zoom: options => {
            controlPosition = options.position;
            return { addTo: instance => assert.equal(instance, map) };
        } },
        tileLayer: () => ({ addTo: instance => assert.equal(instance, map) })
    };
    try {
        app.initMap();
        assert.equal(mapOptions.scrollWheelZoom, true);
        assert.equal(controlPosition, 'bottomright');
        assert.equal(app.map, map);
    } finally {
        delete context.L;
    }
});

test('latency parsing preserves zero and converts supported microsecond units', () => {
    const app = Object.create(App.prototype);
    for (const [value, expected] of [[0, 0], ['0 ms', 0], [1.5, 1.5], ['12.50 ms', 12.5], ['500 us', 0.5], ['500 \u00b5s', 0.5], ['.25 MS', 0.25], ['14', 14]]) {
        assert.equal(app.parseLatency(value), expected);
    }
    for (const value of [null, undefined, '', 'unavailable', -1, Infinity, NaN, {}, '2 seconds']) {
        assert.equal(app.parseLatency(value), null);
    }
});

test('aggregation retains the latest valid measurement and the sample count', () => {
    const app = Object.create(App.prototype);
    const result = app.aggregateLatencyData([
        { source: 'francecentral', destination: 'westeurope', latency: '20 ms', timestamp: '2026-01-01' },
        { source: 'francecentral', destination: 'westeurope', latency: '500 us', timestamp: '2026-01-03' },
        { source: 'francecentral', destination: 'westeurope', latency: '10 ms', timestamp: '2026-01-02' },
        { source: 'westeurope', destination: 'francecentral', latency: 0, timestamp: '2026-01-03' },
        { source: 'invalid', destination: 'region', latency: 'unknown', timestamp: '2026-01-04' }
    ]);
    assert.equal(result.connections.length, 2);
    assert.equal(result.regions.length, 2);
    assert.equal(result.connections[0].latency, 0.5);
    assert.equal(result.connections[0].measurementCount, 3);
    assert.equal(result.connections[1].latency, 0);
});

test('RTT requires both directional measurements, including zero', () => {
    const app = Object.create(App.prototype);
    app.latencyData = { connections: [
        { source: 'francecentral', destination: 'westeurope', latency: 0 },
        { source: 'westeurope', destination: 'francecentral', latency: 5 },
        { source: 'francecentral', destination: 'eastus', latency: 70 }
    ] };
    const stats = app.computeRegionRttStats('francecentral');
    assert.equal(stats.peers, 1);
    assert.equal(stats.avgRtt, 5);
    assert.equal(stats.best.id, 'westeurope');
});

test('demo data is deterministic and never claims a measurement timestamp', () => {
    const app = Object.create(App.prototype);
    const first = app.generateDemoData();
    const second = app.generateDemoData();
    assert.equal(first.connections.length, first.regions.length * (first.regions.length - 1));
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert(first.connections.every(connection => connection.timestamp === null && connection.measurementCount === 0));
});

test('matrix and map share the same latency unit parsing', () => {
    const matrix = new Matrix({});
    assert.equal(matrix._parseLatency('500 us'), 0.5);
    assert.equal(matrix._parseLatency(0), 0);
    assert.equal(matrix._parseLatency('invalid'), null);
});

test('clearing matrix sources stays empty, including after URL restoration', () => {
    context.window.location = new URL('http://localhost:8080/?source=francecentral');
    const matrix = new Matrix({});
    matrix.sourceRegions = ['francecentral', 'westeurope'];
    matrix.destRegions = [...matrix.sourceRegions];
    matrix._sourceSelection = new Set();
    matrix._applyFilters();
    assert.equal(matrix.filteredSources.length, 0);
    assert.equal(matrix.filteredDests.length, 2);
    matrix._syncURLParams();
    assert.equal(context.window.location.searchParams.get('msrc'), '');
    assert.equal(context.window.location.searchParams.get('source'), 'francecentral');
    matrix._sourceSelection = null;
    matrix._readURLParams();
    matrix._applyFilters();
    assert.equal(matrix.filteredSources.length, 0);
});

test('matrix geography filters both axes and respects explicit selections', () => {
    const matrix = new Matrix({});
    matrix.sourceRegions = ['francecentral', 'westeurope', 'eastus'];
    matrix.destRegions = [...matrix.sourceRegions];
    matrix.geoFilter = 'europe';
    matrix._destSelection = new Set(['westeurope']);
    matrix._applyFilters();
    assert.equal(matrix.filteredSources.length, 2);
    assert.equal(matrix.filteredDests.join(','), 'westeurope');
});

test('matrix average sorting uses outbound rows and inbound columns', () => {
    const matrix = new Matrix({});
    matrix.sourceRegions = ['eastus', 'francecentral'];
    matrix.destRegions = ['westeurope', 'japaneast'];
    matrix.sortMode = 'latency';
    matrix.latencyLookup = new Map([
        ['francecentral|westeurope', 10], ['eastus|westeurope', 20],
        ['francecentral|japaneast', 1], ['eastus|japaneast', 3]
    ]);
    matrix._applyFilters();
    assert.equal(matrix.filteredSources.join(','), 'francecentral,eastus');
    assert.equal(matrix.filteredDests.join(','), 'japaneast,westeurope');
});

test('refreshing the matrix removes obsolete connections', () => {
    context.window.location = new URL('http://localhost:8080/');
    const matrix = new Matrix({});
    matrix._render = () => {};
    matrix.init([], { regions: ['francecentral', 'westeurope'], connections: [{ source: 'francecentral', destination: 'westeurope', latency: 12 }] });
    assert.equal(matrix._getLatency('francecentral', 'westeurope'), 12);
    matrix.init([], { regions: ['francecentral', 'westeurope'], connections: [] });
    assert.equal(matrix._getLatency('francecentral', 'westeurope'), null);
});

test('matrix history retains zero values and sorts valid dated samples', () => {
    const matrix = new Matrix({});
    matrix.rawData = [
        { source: 'francecentral', destination: 'westeurope', latency: '2 ms', timestamp: '2026-02-02' },
        { source: 'francecentral', destination: 'westeurope', latency: 0, timestamp: '2026-02-01' },
        { source: 'francecentral', destination: 'westeurope', latency: '3 ms', timestamp: 'invalid' }
    ];
    matrix._buildHistoryMap();
    const samples = matrix.historyMap.get('francecentral|westeurope');
    assert.equal(samples.length, 2);
    assert.equal(samples[0].latency, 0);
});

test('latency colors match their legends at every RTT and one-way boundary', () => {
    const app = Object.create(App.prototype);
    const matrix = new Matrix({});
    const css = readFileSync(join(frontend, 'styles.css'), 'utf8');
    const bands = [
        { name: 'critical', lower: 0, upper: 5, fill: '#2e7d32' },
        { name: 'realtime', lower: 5, upper: 25, fill: '#e8c547' },
        { name: 'interactive', lower: 25, upper: 75, fill: '#e88b3a' },
        { name: 'standard', lower: 75, upper: 200, fill: '#cb4b3f' },
        { name: 'async', lower: 200, upper: 1000, fill: '#7a2336' }
    ];
    for (const band of bands) {
        const stroke = css.match(new RegExp(`--${band.name}:\\s*(#[a-f0-9]+)`))[1];
        const text = css.match(new RegExp(`--${band.name}-text:\\s*(#[a-f0-9]+)`))[1];
        for (const latency of [band.lower, band.upper - 0.001]) {
            assert.equal(app.getLatencyClass(latency), band.name);
            assert.equal(app.getRttClass(latency * 2), band.name);
            assert.equal(app.getRttColor(latency * 2), stroke);
            assert.equal(app.getRttTextColor(latency * 2), text);
            assert.equal(matrix._getColor(latency), band.fill);
            assert.equal(matrix._getColor(latency), app.getRttColor(latency * 2));
        }
    }
    assert(!bands.some(band => band.fill === matrix._getColor(null)));
    assert.notEqual(app.getRttColor(null), app.getRttColor(0));
    assert(css.includes('--success: #107c10;'));
});

test('latency values keep AA text contrast on map details, selections and matrix cells', () => {
    const app = Object.create(App.prototype);
    const matrix = new Matrix({});
    const luminance = color => {
        const channels = color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255)
            .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const contrast = (foreground, background) => {
        const values = [luminance(foreground), luminance(background)].sort((first, second) => second - first);
        return (values[0] + 0.05) / (values[1] + 0.05);
    };
    for (const latency of [0, 5, 25, 75, 200]) {
        assert(contrast(matrix._getTextColor(latency), matrix._getColor(latency)) >= 4.5, `Matrix band ${latency}`);
        for (const background of ['#ffffff', '#f5f5f5', '#eff6fc']) {
            assert(contrast(app.getRttTextColor(latency * 2), background) >= 4.5, `RTT band ${latency * 2} on ${background}`);
        }
    }
    assert(contrast(matrix._getTextColor(null), matrix._getColor(null)) >= 4.5);
});