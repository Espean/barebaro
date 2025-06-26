const { BlobServiceClient } = require('@azure/storage-blob');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');
const { v4: uuidv4 } = require('uuid');
const Busboy = require('busboy');

module.exports = async function (context, req) {
  if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
    context.res = { status: 400, body: 'Content-Type must be multipart/form-data' };
    return;
  }

  const connectionString = process.env["AzureWebJobsStorage"];
  const containerName = "recordings";
  const tableName = process.env["METADATA_TABLE_NAME"] || "audiometadata";
  const blobName = uuidv4() + ".webm";

  let name = '';
  let category = '';
  let fileBuffer = Buffer.alloc(0);

  await new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: req.headers });
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });
    busboy.on('field', (fieldname, val) => {
      if (fieldname === 'name') name = val;
      if (fieldname === 'category') category = val;
    });
    busboy.on('finish', resolve);
    busboy.on('error', reject);
    busboy.end(req.body);
  });

  // Upload to Blob Storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(fileBuffer);

  // Store metadata in Table Storage
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
      size: fileBuffer.length,
      name: name || '',
      category: category || ''
    };
    await tableClient.createEntity(entity);
  }

  context.res = {
    status: 200,
    body: { message: "Upload successful", blobName }
  };
};
