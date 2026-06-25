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
 * - regionType: Region classification ("recommended", "restricted" or "other")
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
 * @type {Object.<string, {displayName: string, coordinates: number[], country: string, geoGroup: string, regionType: string}>}
 */
const AZURE_REGIONS = {
    // United States
    "eastus": {
        displayName: "East US",
        coordinates: [37.4316, -78.6569],
        city: "Virginia",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "recommended"
    },
    "eastus2": {
        displayName: "East US 2",
        coordinates: [36.6749, -78.3899],
        city: "Virginia",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "other"
    },
    "centralus": {
        displayName: "Central US",
        coordinates: [41.8780, -93.0977],
        city: "Iowa",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "recommended"
    },
    "northcentralus": {
        displayName: "North Central US",
        coordinates: [41.8819, -87.6278],
        city: "Illinois",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "other"
    },
    "southcentralus": {
        displayName: "South Central US",
        coordinates: [29.7604, -95.3698],
        city: "Texas",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "other"
    },
    "westcentralus": {
        displayName: "West Central US",
        coordinates: [41.1400, -104.8202],
        city: "Wyoming",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "other"
    },
    "westus": {
        displayName: "West US",
        coordinates: [37.7749, -122.4194],
        city: "California",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "other"
    },
    "westus2": {
        displayName: "West US 2",
        coordinates: [47.6062, -122.3321],
        city: "Washington",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "recommended"
    },
    "westus3": {
        displayName: "West US 3",
        coordinates: [33.4484, -112.0740],
        city: "Phoenix",
        country: "United States",
        geoGroup: "northamerica",
        regionType: "other"
    },
    // Canada
    "canadacentral": {
        displayName: "Canada Central",
        coordinates: [43.6532, -79.3832],
        city: "Toronto",
        country: "Canada",
        geoGroup: "northamerica",
        regionType: "recommended"
    },
    "canadaeast": {
        displayName: "Canada East",
        coordinates: [46.8139, -71.2080],
        city: "Quebec",
        country: "Canada",
        geoGroup: "northamerica",
        regionType: "other"
    },
    // Latin America
    "brazilsouth": {
        displayName: "Brazil South",
        coordinates: [-23.5505, -46.6333],
        city: "São Paulo",
        country: "Brazil",
        geoGroup: "latinamerica",
        regionType: "recommended"
    },
    "chilecentral": {
        displayName: "Chile Central",
        coordinates: [-33.4489, -70.6693],
        city: "Santiago",
        country: "Chile",
        geoGroup: "latinamerica",
        regionType: "recommended"
    },
    "mexicocentral": {
        displayName: "Mexico Central",
        coordinates: [20.5881, -100.3899],
        city: "Querétaro",
        country: "Mexico",
        geoGroup: "latinamerica",
        regionType: "recommended"
    },
    // Europe
    "northeurope": {
        displayName: "North Europe",
        coordinates: [53.3498, -6.2603],
        city: "Dublin",
        country: "Ireland",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "westeurope": {
        displayName: "West Europe",
        coordinates: [52.3676, 4.9041],
        city: "Amsterdam",
        country: "Netherlands",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "uksouth": {
        displayName: "UK South",
        coordinates: [51.5074, -0.1278],
        city: "London",
        country: "United Kingdom",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "ukwest": {
        displayName: "UK West",
        coordinates: [51.4816, -3.1791],
        city: "Cardiff",
        country: "United Kingdom",
        geoGroup: "europe",
        regionType: "other"
    },
    "francecentral": {
        displayName: "France Central",
        coordinates: [48.8566, 2.3522],
        city: "Paris",
        country: "France",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "francesouth": {
        displayName: "France South",
        coordinates: [43.2965, 5.3698],
        city: "Marseille",
        country: "France",
        geoGroup: "europe",
        regionType: "restricted"
    },
    "germanywestcentral": {
        displayName: "Germany West Central",
        coordinates: [50.1109, 8.6821],
        city: "Frankfurt",
        country: "Germany",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "switzerlandnorth": {
        displayName: "Switzerland North",
        coordinates: [47.3769, 8.5417],
        city: "Zurich",
        country: "Switzerland",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "swedencentral": {
        displayName: "Sweden Central",
        coordinates: [60.6749, 17.1413],
        city: "Gävle",
        country: "Sweden",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "norwayeast": {
        displayName: "Norway East",
        coordinates: [59.9139, 10.7522],
        city: "Oslo",
        country: "Norway",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "italynorth": {
        displayName: "Italy North",
        coordinates: [45.4642, 9.1900],
        city: "Milan",
        country: "Italy",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "polandcentral": {
        displayName: "Poland Central",
        coordinates: [52.2297, 21.0122],
        city: "Warsaw",
        country: "Poland",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "spaincentral": {
        displayName: "Spain Central",
        coordinates: [40.4168, -3.7038],
        city: "Madrid",
        country: "Spain",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "belgiumcentral": {
        displayName: "Belgium Central",
        coordinates: [50.8503, 4.3517],
        city: "Brussels",
        country: "Belgium",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "austriaeast": {
        displayName: "Austria East",
        coordinates: [48.2082, 16.3738],
        city: "Vienna",
        country: "Austria",
        geoGroup: "europe",
        regionType: "recommended"
    },
    // Australia & New Zealand
    "australiaeast": {
        displayName: "Australia East",
        coordinates: [-33.8688, 151.2093],
        city: "New South Wales",
        country: "Australia",
        geoGroup: "oceania",
        regionType: "recommended"
    },
    "australiasoutheast": {
        displayName: "Australia Southeast",
        coordinates: [-37.8136, 144.9631],
        city: "Victoria",
        country: "Australia",
        geoGroup: "oceania",
        regionType: "other"
    },
    "newzealandnorth": {
        displayName: "New Zealand North",
        coordinates: [-36.8509, 174.7645],
        city: "Auckland",
        country: "New Zealand",
        geoGroup: "oceania",
        regionType: "recommended"
    },
    // Asia Pacific
    "southeastasia": {
        displayName: "Southeast Asia",
        coordinates: [1.3521, 103.8198],
        city: "Singapore",
        country: "Singapore",
        geoGroup: "asiapacific",
        regionType: "recommended"
    },
    "eastasia": {
        displayName: "East Asia",
        coordinates: [22.3193, 114.1694],
        city: "Hong Kong",
        country: "Hong Kong SAR",
        geoGroup: "asiapacific",
        regionType: "recommended"
    },
    "japaneast": {
        displayName: "Japan East",
        coordinates: [35.6762, 139.6503],
        city: "Tokyo, Saitama",
        country: "Japan",
        geoGroup: "asiapacific",
        regionType: "recommended"
    },
    "japanwest": {
        displayName: "Japan West",
        coordinates: [34.6937, 135.5023],
        city: "Osaka",
        country: "Japan",
        geoGroup: "asiapacific",
        regionType: "recommended"
    },
    "koreacentral": {
        displayName: "Korea Central",
        coordinates: [37.5665, 126.9780],
        city: "Seoul",
        country: "South Korea",
        geoGroup: "asiapacific",
        regionType: "recommended"
    },
    "koreasouth": {
        displayName: "Korea South",
        coordinates: [35.1796, 129.0756],
        city: "Busan",
        country: "South Korea",
        geoGroup: "asiapacific",
        regionType: "other"
    },
    "indonesiacentral": {
        displayName: "Indonesia Central",
        coordinates: [-6.2088, 106.8456],
        city: "Jakarta",
        country: "Indonesia",
        geoGroup: "asiapacific",
        regionType: "recommended"
    },
    "malaysiawest": {
        displayName: "Malaysia West",
        coordinates: [3.1390, 101.6869],
        city: "Kuala Lumpur",
        country: "Malaysia",
        geoGroup: "asiapacific",
        regionType: "recommended"
    },
    // India
    "centralindia": {
        displayName: "Central India",
        coordinates: [18.5204, 73.8567],
        city: "Pune",
        country: "India",
        geoGroup: "india",
        regionType: "recommended"
    },
    "southindia": {
        displayName: "South India",
        coordinates: [13.0827, 80.2707],
        city: "Chennai",
        country: "India",
        geoGroup: "india",
        regionType: "other"
    },
    "westindia": {
        displayName: "West India",
        coordinates: [19.0760, 72.8777],
        city: "Mumbai",
        country: "India",
        geoGroup: "india",
        regionType: "other"
    },
    // Middle East
    "uaenorth": {
        displayName: "UAE North",
        coordinates: [25.2048, 55.2708],
        city: "Dubai",
        country: "United Arab Emirates",
        geoGroup: "middleeast",
        regionType: "recommended"
    },
    "qatarcentral": {
        displayName: "Qatar Central",
        coordinates: [25.2854, 51.5310],
        city: "Doha",
        country: "Qatar",
        geoGroup: "middleeast",
        regionType: "recommended"
    },
    "israelcentral": {
        displayName: "Israel Central",
        coordinates: [32.0853, 34.7818],
        city: "Tel Aviv",
        country: "Israel",
        geoGroup: "middleeast",
        regionType: "recommended"
    },
    // Africa
    "southafricanorth": {
        displayName: "South Africa North",
        coordinates: [-26.2041, 28.0473],
        city: "Johannesburg",
        country: "South Africa",
        geoGroup: "africa",
        regionType: "recommended"
    },
    // Additional regions
    "denmarkeast": {
        displayName: "Denmark East",
        coordinates: [55.6761, 12.5683],
        city: "Copenhagen",
        country: "Denmark",
        geoGroup: "europe",
        regionType: "recommended"
    },
    "australiacentral": {
        displayName: "Australia Central",
        coordinates: [-35.2809, 149.1300],
        city: "Canberra",
        country: "Australia",
        geoGroup: "oceania",
        regionType: "other"
    }
};
