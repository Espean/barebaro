const { BlobServiceClient } = require('@azure/storage-blob');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

module.exports = async function (context, req) {
  try {
    // Validate input
    if (!req.body || !req.body.length || !req.query.name) {
      context.res = { status: 400, body: 'Missing audio file or name.' };
      return;
    }
    const name = req.query.name;
    // Azure Blob Storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient('audio');
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(`${name}.wav`);
    await blockBlobClient.uploadData(req.body);
    // Azure Table Storage
    const tableClient = new TableClient(
      process.env.AZURE_STORAGE_CONNECTION_STRING,
      'AudioMetadata'
    );
    await tableClient.createTable();
    await tableClient.createEntity({
      partitionKey: 'audio',
      rowKey: name,
      fileName: `${name}.wav`,
      uploaded: new Date().toISOString()
    });
    context.res = { status: 200, body: 'Upload successful.' };
  } catch (err) {
    context.log.error('Upload error:', err);
    context.res = { status: 500, body: 'Server error: ' + err.message };
  }
};