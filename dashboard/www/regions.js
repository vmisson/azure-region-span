/**
 * Azure Region Coordinates and Metadata
 * 
 * This file contains geographic coordinates and metadata for all Azure regions
 * used in the latency visualization map.
 * 
 * Each region includes:
 * - displayName: Human-readable region name
 * - coordinates: [latitude, longitude] for map placement
 * - country: Country where the region is located
 * - geoGroup: Geographic grouping for filtering
 * - hasAvailabilityZones: Whether the region supports Availability Zones
 * 
 * @author vmisson
 * @see https://github.com/vmisson/azure-region-span
 */

/**
 * Geographic group definitions for region filtering.
 * @type {Object.<string, {displayName: string}>}
 */
const GEO_GROUPS = {
    "northamerica": { displayName: "North America" },
    "latinamerica": { displayName: "Latin America" },
    "europe": { displayName: "Europe" },
    "asiapacific": { displayName: "Asia Pacific" },
    "india": { displayName: "India" },
    "middleeast": { displayName: "Middle East" },
    "africa": { displayName: "Africa" },
    "oceania": { displayName: "Oceania" }
};

/**
 * Azure region definitions with coordinates and metadata.
 * @type {Object.<string, {displayName: string, coordinates: number[], country: string, geoGroup: string, hasAvailabilityZones: boolean}>}
 */
const AZURE_REGIONS = {
    // United States
    "eastus": {
        displayName: "East US",
        coordinates: [37.4316, -78.6569], // Virginia
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: true
    },
    "eastus2": {
        displayName: "East US 2",
        coordinates: [37.4316, -78.6569], // Virginia
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: true
    },
    "centralus": {
        displayName: "Central US",
        coordinates: [41.8780, -93.0977], // Iowa
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: true
    },
    "northcentralus": {
        displayName: "North Central US",
        coordinates: [41.8819, -87.6278], // Illinois (Chicago)
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: false
    },
    "southcentralus": {
        displayName: "South Central US",
        coordinates: [29.7604, -95.3698], // Texas (Houston)
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: true
    },
    "westcentralus": {
        displayName: "West Central US",
        coordinates: [41.1400, -104.8202], // Wyoming (Cheyenne)
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: false
    },
    "westus": {
        displayName: "West US",
        coordinates: [37.7749, -122.4194], // California (San Francisco)
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: false
    },
    "westus2": {
        displayName: "West US 2",
        coordinates: [47.6062, -122.3321], // Washington (Seattle)
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: true
    },
    "westus3": {
        displayName: "West US 3",
        coordinates: [33.4484, -112.0740], // Phoenix, Arizona
        country: "United States",
        geoGroup: "northamerica",
        hasAvailabilityZones: true
    },
    // Canada
    "canadacentral": {
        displayName: "Canada Central",
        coordinates: [43.6532, -79.3832], // Toronto
        country: "Canada",
        geoGroup: "northamerica",
        hasAvailabilityZones: true
    },
    "canadaeast": {
        displayName: "Canada East",
        coordinates: [46.8139, -71.2080], // Quebec City
        country: "Canada",
        geoGroup: "northamerica",
        hasAvailabilityZones: false
    },
    // Latin America
    "brazilsouth": {
        displayName: "Brazil South",
        coordinates: [-23.5505, -46.6333], // São Paulo
        country: "Brazil",
        geoGroup: "latinamerica",
        hasAvailabilityZones: true
    },
    "chilecentral": {
        displayName: "Chile Central",
        coordinates: [-33.4489, -70.6693], // Santiago
        country: "Chile",
        geoGroup: "latinamerica",
        hasAvailabilityZones: true
    },
    "mexicocentral": {
        displayName: "Mexico Central",
        coordinates: [20.5881, -100.3899], // Querétaro
        country: "Mexico",
        geoGroup: "latinamerica",
        hasAvailabilityZones: true
    },
    // Europe
    "northeurope": {
        displayName: "North Europe",
        coordinates: [53.3498, -6.2603], // Dublin, Ireland
        country: "Ireland",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "westeurope": {
        displayName: "West Europe",
        coordinates: [52.3676, 4.9041], // Amsterdam, Netherlands
        country: "Netherlands",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "uksouth": {
        displayName: "UK South",
        coordinates: [51.5074, -0.1278], // London
        country: "United Kingdom",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "ukwest": {
        displayName: "UK West",
        coordinates: [51.4816, -3.1791], // Cardiff
        country: "United Kingdom",
        geoGroup: "europe",
        hasAvailabilityZones: false
    },
    "francecentral": {
        displayName: "France Central",
        coordinates: [48.8566, 2.3522], // Paris
        country: "France",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "germanywestcentral": {
        displayName: "Germany West Central",
        coordinates: [50.1109, 8.6821], // Frankfurt
        country: "Germany",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "switzerlandnorth": {
        displayName: "Switzerland North",
        coordinates: [47.3769, 8.5417], // Zurich
        country: "Switzerland",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "swedencentral": {
        displayName: "Sweden Central",
        coordinates: [60.6749, 17.1413], // Gävle
        country: "Sweden",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "norwayeast": {
        displayName: "Norway East",
        coordinates: [59.9139, 10.7522], // Oslo
        country: "Norway",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "italynorth": {
        displayName: "Italy North",
        coordinates: [45.4642, 9.1900], // Milan
        country: "Italy",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "polandcentral": {
        displayName: "Poland Central",
        coordinates: [52.2297, 21.0122], // Warsaw
        country: "Poland",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "spaincentral": {
        displayName: "Spain Central",
        coordinates: [40.4168, -3.7038], // Madrid
        country: "Spain",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "belgiumcentral": {
        displayName: "Belgium Central",
        coordinates: [50.8503, 4.3517], // Brussels
        country: "Belgium",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    "austriaeast": {
        displayName: "Austria East",
        coordinates: [48.2082, 16.3738], // Vienna
        country: "Austria",
        geoGroup: "europe",
        hasAvailabilityZones: true
    },
    // Australia & New Zealand
    "australiaeast": {
        displayName: "Australia East",
        coordinates: [-33.8688, 151.2093], // Sydney, New South Wales
        country: "Australia",
        geoGroup: "oceania",
        hasAvailabilityZones: true
    },
    "australiasoutheast": {
        displayName: "Australia Southeast",
        coordinates: [-37.8136, 144.9631], // Melbourne, Victoria
        country: "Australia",
        geoGroup: "oceania",
        hasAvailabilityZones: false
    },
    "newzealandnorth": {
        displayName: "New Zealand North",
        coordinates: [-36.8509, 174.7645], // Auckland
        country: "New Zealand",
        geoGroup: "oceania",
        hasAvailabilityZones: true
    },
    // Asia Pacific
    "southeastasia": {
        displayName: "Southeast Asia",
        coordinates: [1.3521, 103.8198], // Singapore
        country: "Singapore",
        geoGroup: "asiapacific",
        hasAvailabilityZones: true
    },
    "eastasia": {
        displayName: "East Asia",
        coordinates: [22.3193, 114.1694], // Hong Kong
        country: "Hong Kong",
        geoGroup: "asiapacific",
        hasAvailabilityZones: true
    },
    "japaneast": {
        displayName: "Japan East",
        coordinates: [35.6762, 139.6503], // Tokyo
        country: "Japan",
        geoGroup: "asiapacific",
        hasAvailabilityZones: true
    },
    "japanwest": {
        displayName: "Japan West",
        coordinates: [34.6937, 135.5023], // Osaka
        country: "Japan",
        geoGroup: "asiapacific",
        hasAvailabilityZones: true
    },
    "koreacentral": {
        displayName: "Korea Central",
        coordinates: [37.5665, 126.9780], // Seoul
        country: "South Korea",
        geoGroup: "asiapacific",
        hasAvailabilityZones: true
    },
    "koreasouth": {
        displayName: "Korea South",
        coordinates: [35.1796, 129.0756], // Busan
        country: "South Korea",
        geoGroup: "asiapacific",
        hasAvailabilityZones: false
    },
    "indonesiacentral": {
        displayName: "Indonesia Central",
        coordinates: [-6.2088, 106.8456], // Jakarta
        country: "Indonesia",
        geoGroup: "asiapacific",
        hasAvailabilityZones: true
    },
    "malaysiawest": {
        displayName: "Malaysia West",
        coordinates: [3.1390, 101.6869], // Kuala Lumpur
        country: "Malaysia",
        geoGroup: "asiapacific",
        hasAvailabilityZones: true
    },
    // India
    "centralindia": {
        displayName: "Central India",
        coordinates: [18.5204, 73.8567], // Pune
        country: "India",
        geoGroup: "india",
        hasAvailabilityZones: true
    },
    "southindia": {
        displayName: "South India",
        coordinates: [13.0827, 80.2707], // Chennai
        country: "India",
        geoGroup: "india",
        hasAvailabilityZones: false
    },
    "westindia": {
        displayName: "West India",
        coordinates: [19.0760, 72.8777], // Mumbai
        country: "India",
        geoGroup: "india",
        hasAvailabilityZones: false
    },
    // Middle East
    "uaenorth": {
        displayName: "UAE North",
        coordinates: [25.2048, 55.2708], // Dubai
        country: "United Arab Emirates",
        geoGroup: "middleeast",
        hasAvailabilityZones: true
    },
    "qatarcentral": {
        displayName: "Qatar Central",
        coordinates: [25.2854, 51.5310], // Doha
        country: "Qatar",
        geoGroup: "middleeast",
        hasAvailabilityZones: true
    },
    "israelcentral": {
        displayName: "Israel Central",
        coordinates: [32.0853, 34.7818], // Tel Aviv
        country: "Israel",
        geoGroup: "middleeast",
        hasAvailabilityZones: true
    },
    // Africa
    "southafricanorth": {
        displayName: "South Africa North",
        coordinates: [-26.2041, 28.0473], // Johannesburg
        country: "South Africa",
        geoGroup: "africa",
        hasAvailabilityZones: true
    }
};
