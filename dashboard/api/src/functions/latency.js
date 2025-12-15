const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { ManagedIdentityCredential } = require('@azure/identity');

// Helper function to create table client
function createTableClient(tableName) {
    const storageAccountName = process.env.STORAGE_ACCOUNT_NAME || 'sanetprdfrc002';
    const tableUrl = `https://${storageAccountName}.table.core.windows.net`;
    
    // Use Managed Identity credential
    const credential = new ManagedIdentityCredential();
    return new TableClient(tableUrl, tableName, credential);
}

app.http('getLatencyData', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'latency',
    handler: async (request, context) => {
        try {
            const tableName = process.env.TABLE_NAME || 'region';
            const tableClient = createTableClient(tableName);

            const latencyData = [];
            
            // Query all entities from the table
            const entities = tableClient.listEntities();
            
            for await (const entity of entities) {
                latencyData.push({
                    partitionKey: entity.partitionKey,
                    rowKey: entity.rowKey,
                    source: entity.Source,
                    destination: entity.Destination,
                    latency: entity.Latency,
                    timestamp: entity.timestamp
                });
            }

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(latencyData)
            };
        } catch (error) {
            context.log('Error fetching latency data:', error);
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: error.message })
            };
        }
    }
});


