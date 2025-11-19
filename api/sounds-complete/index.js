const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
  try {
    const { id, durationSeconds, waveform, startSeconds, endSeconds } = req.body || {};
    if (!id) { context.res = { status: 400, body: 'id required' }; return; }
    const cosmos = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const container = cosmos.database(process.env.COSMOS_DATABASE).container(process.env.COSMOS_CONTAINER);
    const userId = req.body.userId || req.headers['x-user-id'] || 'anon';
    const { resource } = await container.item(id, userId).read();
    if (!resource) { context.res = { status: 404, body: 'not found' }; return; }
    resource.status = 'ready';
    if (durationSeconds != null) resource.durationSeconds = durationSeconds;
    if (startSeconds != null) resource.startSeconds = startSeconds;
    if (endSeconds != null) resource.endSeconds = endSeconds;
    if (waveform) resource.waveform = waveform;
    await container.item(id, resource.userId).replace(resource);
    context.res = { status: 200, body: { id, status: 'ready' } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: 'complete failed' };
  }
};
