const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

module.exports = async function (context, req) {
  const connectionString = process.env["AzureWebJobsStorage"];
  const tableName = process.env["METADATA_TABLE_NAME"] || "audiometadata";

  // Parse connection string for account/key
  const accountMatch = connectionString.match(/AccountName=([^;]+)/);
  const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
  if (!(accountMatch && keyMatch)) {
    context.res = { status: 500, body: 'Storage account credentials not found.' };
    return;
  }
  const account = accountMatch[1];
  const key = keyMatch[1];
  const credential = new AzureNamedKeyCredential(account, key);
  const tableClient = new TableClient(
    `https://${account}.table.core.windows.net`,
    tableName,
    credential
  );

  // Query all recordings
  const recordings = [];
  for await (const entity of tableClient.listEntities()) {
    recordings.push({
      name: entity.name,
      category: entity.category,
      fileName: entity.fileName,
      uploadTime: entity.uploadTime,
      size: entity.size,
      rowKey: entity.rowKey
    });
  }

  context.res = {
    status: 200,
    body: recordings
  };
};
