const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
  try {
    const { id, durationSeconds, waveform } = req.body || {};
    if (!id) { context.res = { status: 400, body: 'id required' }; return; }
    const cosmos = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const container = cosmos.database(process.env.COSMOS_DATABASE).container(process.env.COSMOS_CONTAINER);
    // Patch item: set status ready
    const { resource } = await container.item(id, req.headers['x-user-id'] || 'anon').read();
    if (!resource) { context.res = { status: 404, body: 'not found' }; return; }
    resource.status = 'ready';
    if (durationSeconds != null) resource.durationSeconds = durationSeconds;
    if (waveform) resource.waveform = waveform;
    await container.item(id, resource.userId).replace(resource);
    context.res = { status: 200, body: { id, status: 'ready' } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: 'complete failed' };
  }
};
