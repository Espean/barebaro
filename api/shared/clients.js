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
const { required, cosmosEndpoint, cosmosDatabase, cosmosContainer, cosmosKey, storageAccount, storageKey, storageUrl } = require('./config');

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

const createUploadSas = ({ blobName, expiresOnMinutes = 15, contentType }) => {
  const permissions = BlobSASPermissions.parse('cw');
  const expiresOn = new Date(Date.now() + expiresOnMinutes * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: required('AUDIO_CONTAINER'),
      blobName,
      permissions,
      expiresOn,
      contentType,
      protocol: 'https',
    },
    getSharedKeyCredential()
  );
  const baseUrl = `${storageUrl().replace(/\/$/, '')}/${required('AUDIO_CONTAINER')}/${encodeURIComponent(blobName)}`;
  return `${baseUrl}?${sas.toString()}`;
};

module.exports = {
  getCosmosContainer,
  getBlobServiceClient,
  createUploadSas,
};
