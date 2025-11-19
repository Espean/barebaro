const { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');
const crypto = require('crypto');

module.exports = async function (context, req) {
  try {
    const userId = req.headers['x-user-id'] || 'anon';
    const { filename, title, tags = [] } = req.body || {};
    if (!filename) {
      context.res = { status: 400, body: 'filename required' }; return;
    }

    const id = crypto.randomUUID();
    const blobName = `${id}${filename.toLowerCase().endsWith('.wav') ? '' : '.wav'}`;
    const containerName = process.env.AUDIO_CONTAINER;

    // TODO: Move to managed identity (remove key parsing) later.
    const conn = process.env.AzureWebJobsStorage;
    const account = /AccountName=([^;]+)/.exec(conn)[1];
    const key = /AccountKey=([^;]+)/.exec(conn)[1];
    const cred = new StorageSharedKeyCredential(account, key);

    const sas = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('cw'), // create + write
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + 30 * 60 * 1000)
    }, cred).toString();

    const uploadUrl = `https://${account}.blob.core.windows.net/${containerName}/${blobName}?${sas}`;

    const cosmos = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const container = cosmos.database(process.env.COSMOS_DATABASE).container(process.env.COSMOS_CONTAINER);

    await container.items.create({
      id,
      userId,
      filenameOriginal: filename,
      title: title || filename,
      tags,
      blobPath: `${containerName}/${blobName}`,
      uploadedAt: new Date().toISOString(),
      status: 'uploading'
    });

    context.res = { status: 200, body: { id, uploadUrl } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: 'init-upload failed' };
  }
};
