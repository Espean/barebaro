'use strict';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getUserId = (req) => {
  const headerId = req?.headers?.['x-user-id'] || req?.headers?.['X-User-Id'];
  if (headerId && typeof headerId === 'string') {
    return headerId;
  }
  if (req?.query?.userId) {
    return String(req.query.userId);
  }
  if (req?.body?.userId) {
    return String(req.body.userId);
  }
  return 'anonymous';
};

module.exports = {
  required,
  getUserId,
  audioContainer: () => required('AUDIO_CONTAINER'),
  cosmosEndpoint: () => required('COSMOS_ENDPOINT'),
  cosmosDatabase: () => required('COSMOS_DATABASE'),
  cosmosContainer: () => required('COSMOS_CONTAINER'),
  cosmosKey: () => required('COSMOS_KEY'),
  storageAccount: () => required('AUDIO_STORAGE_ACCOUNT'),
  storageKey: () => required('AUDIO_STORAGE_KEY'),
  storageUrl: () => required('AUDIO_STORAGE_URL'),
};
