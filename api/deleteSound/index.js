'use strict';

const { getCosmosContainer, getBlobServiceClient } = require('../shared/clients');
const { getUserId, audioContainer } = require('../shared/config');

module.exports = async function deleteSound(context, req) {
  try {
    const userId = getUserId(req);
    const soundId = context.bindingData.id;

    if (!soundId) {
      context.res = {
        status: 400,
        body: { error: 'Sound id is required.' },
      };
      return;
    }

    const container = getCosmosContainer();
    const { resource: existing } = await container.item(soundId, userId).read();

    if (!existing) {
      context.res = {
        status: 404,
        body: { error: 'Sound metadata not found.' },
      };
      return;
    }

    const blobService = getBlobServiceClient();
    const audioContainerClient = blobService.getContainerClient(audioContainer());
    const blobClient = audioContainerClient.getBlobClient(existing.blobName);

    await blobClient.deleteIfExists();
    await container.item(soundId, userId).delete();

    context.res = {
      status: 200,
      body: { message: 'Sound deleted.' },
    };
  } catch (error) {
    context.log.error('deleteSound failed', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to delete sound.' },
    };
  }
};
