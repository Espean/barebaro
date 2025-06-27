const { TableClient } = require('@azure/data-tables');

module.exports = async function (context, req) {
  try {
    const tableClient = new TableClient(
      process.env.AZURE_STORAGE_CONNECTION_STRING,
      'AudioMetadata'
    );
    let entities = [];
    for await (const entity of tableClient.listEntities()) {
      entities.push(entity);
    }
    context.res = { status: 200, body: entities };
  } catch (err) {
    context.log.error('List error:', err);
    context.res = { status: 500, body: 'Server error: ' + err.message };
  }
};