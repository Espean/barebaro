const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  try {
    const id = context.bindingData.id;
    const userId = req.headers['x-user-id'] || 'anon';
    if (!id) { context.res = { status: 400, body: 'id required' }; return; }

    const cosmos = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const container = cosmos.database(process.env.COSMOS_DATABASE).container(process.env.COSMOS_CONTAINER);
    const { resource } = await container.item(id, userId).read();
    if (!resource) { context.res = { status: 404, body: 'not found' }; return; }

    // Delete blob
    const conn = process.env.AzureWebJobsStorage;
    const blobService = BlobServiceClient.fromConnectionString(conn);
    const audioContainer = blobService.getContainerClient(process.env.AUDIO_CONTAINER);
    const blobClient = audioContainer.getBlobClient(resource.blobPath.split('/').pop());
    await blobClient.deleteIfExists();

    // Delete metadata
    await container.item(id, userId).delete();
    context.res = { status: 200, body: { id, deleted: true } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: 'delete failed' };
  }
};
