const { BlobServiceClient } = require('@azure/storage-blob');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');
const { v4: uuidv4 } = require('uuid');

module.exports = async function (context, req) {
  if (!req.body) {
    context.res = { status: 400, body: 'No file uploaded.' };
    return;
  }

  const connectionString = process.env["AzureWebJobsStorage"];
  const containerName = "recordings";
  const tableName = process.env["METADATA_TABLE_NAME"] || "audiometadata";
  const blobName = uuidv4() + ".webm";

  // Upload to Blob Storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer);

  // Store metadata in Table Storage
  // Parse connection string for account/key
  const accountMatch = connectionString.match(/AccountName=([^;]+)/);
  const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
  if (accountMatch && keyMatch) {
    const account = accountMatch[1];
    const key = keyMatch[1];
    const credential = new AzureNamedKeyCredential(account, key);
    const tableClient = new TableClient(
      `https://${account}.table.core.windows.net`,
      tableName,
      credential
    );
    await tableClient.createTable();
    const entity = {
      partitionKey: "recording",
      rowKey: blobName,
      fileName: blobName,
      uploadTime: new Date().toISOString(),
      size: buffer.length
    };
    await tableClient.createEntity(entity);
  }

  context.res = {
    status: 200,
    body: { message: "Upload successful", blobName }
  };
};
