'use strict';

const nodeCrypto = require('crypto');

if (!globalThis.crypto && nodeCrypto.webcrypto) {
  globalThis.crypto = nodeCrypto.webcrypto;
}

const { CosmosClient } = require('@azure/cosmos');
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} = require('@azure/storage-blob');
const {
  required,
  cosmosEndpoint,
  cosmosDatabase,
  cosmosContainer,
  cosmosKey,
  storageAccount,
  storageKey,
  storageUrl,
  audioContainer,
} = require('./config');

let cosmosContainerRef;
let blobServiceClientRef;
let sharedKeyCredentialRef;

const getCosmosContainer = () => {
  if (!cosmosContainerRef) {
    const client = new CosmosClient({ endpoint: cosmosEndpoint(), key: cosmosKey() });
    cosmosContainerRef = client.database(cosmosDatabase()).container(cosmosContainer());
  }
  return cosmosContainerRef;
};

const getBlobServiceClient = () => {
  if (!blobServiceClientRef) {
    sharedKeyCredentialRef = new StorageSharedKeyCredential(storageAccount(), storageKey());
    blobServiceClientRef = new BlobServiceClient(storageUrl(), sharedKeyCredentialRef);
  }
  return blobServiceClientRef;
};

const getSharedKeyCredential = () => {
  if (!sharedKeyCredentialRef) {
    sharedKeyCredentialRef = new StorageSharedKeyCredential(storageAccount(), storageKey());
  }
  return sharedKeyCredentialRef;
};

const createReadSasUrl = ({ blobName, expiresOnMinutes = 60 }) => {
  if (!blobName) {
    return null;
  }

  const expiresOn = new Date(Date.now() + expiresOnMinutes * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: audioContainer(),
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
      protocol: 'https',
    },
    getSharedKeyCredential()
  );

  const baseUrl = `${storageUrl().replace(/\/$/, '')}/${audioContainer()}/${encodeURIComponent(blobName)}`;
  return `${baseUrl}?${sas.toString()}`;
};

module.exports = {
  getCosmosContainer,
  getBlobServiceClient,
  createReadSasUrl,
};
