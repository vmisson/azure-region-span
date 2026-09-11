# Azure Region Latency Dashboard

An interactive workspace for measured network latency between Azure regions, with a geographic overview and a directional latency matrix.

## Architecture

```
dashboard/
├── package.json              # Local preview and test commands
├── vite.config.js            # Development server and API proxy
├── DECISIONS.md              # Design and implementation decisions
├── tests/
│   └── dashboard.test.cjs    # Data and interaction-contract tests
├── api/                      # Azure Functions API (Node.js)
│   ├── src/functions/
│   │   └── latency.js       # Endpoints for retrieving latency data
│   ├── host.json
│   ├── local.settings.json
│   └── package.json
└── www/                      # Static frontend
    ├── index.html           # Main page with Leaflet map
    ├── styles.css           # Shared responsive design
    ├── app.js               # Application logic
    ├── matrix.js            # Matrix, filters, history and export
    ├── regions.js           # Azure region coordinates
    └── staticwebapp.config.json
```

## Features

- **Global metrics**: Measured regions, directional connections, average one-way latency and fastest connection.
- **Interactive map**: Mouse-wheel zoom around the pointer, zoom buttons, region types, source selection, geographic and individual destination filters, route visibility and fit-to-network controls.
- **Latency ranking**: Search by region or country, sort by RTT or name, inspect both directions and measurement counts, and export visible routes as CSV.
- **Latency matrix**: Geographic filters, searchable source/destination selections, average-latency sorting, sticky headers, measurement-history charts and filtered CSV export.
- **Regional details**: Location, region type, geography, measured peers, average RTT, fastest and slowest peers.
- **Data transparency**: Latest measurement in UTC, explicit demo labeling, refresh/retry and preservation of loaded measurements when a refresh fails.
- **Responsive controls**: Map/Matrix tabs, a compact two-row mobile header, mobile filter drawer, keyboard-accessible controls, arrow-key navigation in the matrix and reduced-motion support.
- **Shareable views**: Source region and matrix filters are reflected in the URL. France Central is the initial source unless the URL specifies another one.

## Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ and npm for the local preview.
- Internet access for the deployed measurement API, Leaflet, Lucide, Google Fonts and the Esri basemap.
- Azure Functions Core Tools v4 and Azure CLI are only needed to run your own backend or deploy.

## Local Preview

From the repository root:

```sh
cd dashboard
npm ci
npm start
```

Open **http://127.0.0.1:8080/**. If that port is occupied, Vite prints the next available port.

No Azure credentials are required for this preview. Vite proxies `/api` to the existing deployed measurement API, avoiding cross-origin restrictions on localhost. The frontend remains static HTML/CSS/JavaScript; Vite is a development dependency, not a production requirement.

Use **http://127.0.0.1:8080/?demo=1** for deterministic synthetic data without calling the measurement API. Demo mode is visibly labeled and never assigns a real measurement date to simulated values. Refresh retries the actual API. If the API fails on the first load, the same labeled demo mode is used; failed later refreshes retain the current dataset.

The last measurement date reflects the dataset, not the page-load time. Map/list values are RTT (outbound plus inbound); matrix values and global latency metrics are one-way. An incomplete directional pair has no RTT.

### Tests

```sh
npm test
```

Tests use Node's built-in test runner and do not require Azure access or a running server. They cover HTML anchors, unit conversion, latest-sample aggregation, RTT, deterministic demo data, matrix filtering, URL state, sorting, history and refreshed lookup data.

## Optional Local API

To use your own storage account instead of the deployed API:

1. Install API dependencies with `npm install` in `dashboard/api`.
2. Set `STORAGE_ACCOUNT_NAME` and `TABLE_NAME` in `dashboard/api/local.settings.json`.
3. Authenticate using `az login` with an account that can read the storage table.
4. Start the Azure Functions backend:

```sh
cd dashboard/api
func start
```

In another terminal, start the frontend with the local backend as its proxy target:

```sh
cd dashboard
LATENCY_API_URL=http://127.0.0.1:7071 npm start
```

The local API is available at `http://127.0.0.1:7071/api/`. Static production hosting continues to use the existing deployed API URL; the API base can also be configured through `window.LATENCY_API_BASE_URL` before loading `app.js`.

## API Endpoints

### GET /api/latency

Returns all raw latency measurements.

**Response:**
```json
[
  {
    "partitionKey": "...",
    "rowKey": "...",
    "source": "francecentral",
    "destination": "westeurope",
    "latency": "12.5 ms",
    "timestamp": "2024-01-15T10:30:00Z"
  }
]
```

### GET /api/latency/matrix

Returns the latency matrix with only the latest measurements.

**Response:**
```json
{
  "regions": ["eastus", "westeurope", "francecentral", ...],
  "connections": [
    {
      "source": "francecentral",
      "destination": "westeurope",
      "latency": 12.5,
      "latencyRaw": "12.5 ms",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Deployment on Azure Static Web Apps

### 1. Create a Static Web App

```bash
az staticwebapp create \
  --name "latency-dashboard" \
  --resource-group "your-rg" \
  --location "westeurope" \
  --source "." \
  --app-location "dashboard/www" \
  --api-location "dashboard/api" \
  --output-location ""
```

### 2. Configure environment variables

In the Azure portal or via CLI:

```bash
az staticwebapp appsettings set \
  --name "latency-dashboard" \
  --setting-names \
    STORAGE_ACCOUNT_NAME="your-storage-account" \
    TABLE_NAME="region"
```

### 3. Configure Storage Account access

The API uses `DefaultAzureCredential` which supports:
- Managed Identity (recommended for production)
- Azure CLI credentials (local development)

Assign the "Storage Table Data Reader" role to the Static Web App identity:

```bash
az role assignment create \
  --assignee "<static-web-app-principal-id>" \
  --role "Storage Table Data Reader" \
  --scope "/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<storage-account>"
```

## Data Structure

Latency data is stored in Azure Table Storage with the following schema:

| Column | Type | Description |
|--------|------|-------------|
| PartitionKey | String | Unique UUID of the measurement |
| RowKey | String | Source region |
| Source | String | Name of the source region |
| Destination | String | Name of the destination region |
| Latency | String | Latency value (e.g., "12.5 ms") |

## Color Legend

The map and ranking use round-trip values; the matrix uses directional values. The five bands have equivalent thresholds:

| Color | RTT (map/ranking) | One-way (matrix) | Class |
|-------|-------------------|------------------|-------|
| Green | < 10 ms | < 5 ms | Critical |
| Golden yellow | 10 to < 50 ms | 5 to < 25 ms | Real-time |
| Orange | 50 to < 150 ms | 25 to < 75 ms | Interactive |
| Red | 150 to < 400 ms | 75 to < 200 ms | Standard |
| Burgundy | >= 400 ms | >= 200 ms | Async |

The interface keeps the Azure portal light palette: Azure blue (`#0078d4`), white surfaces and neutral grays. The latency scale progresses from green through yellow, orange and red to burgundy as latency increases. Map routes, matrix cells and legends share the same colors for equivalent bands. Text uses contrasting shades to keep at least 4.5:1 contrast. Missing measurements remain gray, and routes with incomplete RTTs are dashed. Region markers use a separate key: green for recommended, Azure blue for other and orange for restricted regions. Numerical values and textual labels remain available independently of color.

## Technologies Used

- **Frontend**: HTML5, CSS3, vanilla JavaScript
- **Map**: [Leaflet.js](https://leafletjs.com/)
- **Basemap**: Esri World Light Gray Canvas, with visible source attribution
- **Icons**: [Lucide](https://lucide.dev/)
- **Typography**: Manrope and IBM Plex Mono
- **Local preview**: Vite with an API proxy
- **Tests**: Node.js built-in test runner
- **Backend**: Azure Functions v4 (Node.js)
- **Storage**: Azure Table Storage
- **Auth**: Azure Identity (DefaultAzureCredential)

