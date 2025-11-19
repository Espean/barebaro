const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
  try {
    const id = context.bindingData.id;
    const userId = req.headers['x-user-id'] || 'anon';
    const cosmos = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const container = cosmos.database(process.env.COSMOS_DATABASE).container(process.env.COSMOS_CONTAINER);
    const { resource } = await container.item(id, userId).read();
    if (!resource) { context.res = { status: 404, body: 'not found' }; return; }
    context.res = { status: 200, body: resource };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: 'get failed' };
  }
};
