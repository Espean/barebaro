'use strict';

const { getCosmosContainer } = require('../shared/clients');
const { getUserId } = require('../shared/config');

module.exports = async function completeSound(context, req) {
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

    const payload = req.body || {};

    const updated = {
      ...existing,
      status: payload.status === 'archived' ? 'archived' : 'ready',
      updatedAt: new Date().toISOString(),
      size: typeof payload.size === 'number' ? payload.size : existing.size,
    };

    await container.item(soundId, userId).replace(updated);

    context.res = {
      status: 200,
      body: {
        message: 'Sound marked as ready.',
        sound: updated,
      },
    };
  } catch (error) {
    context.log.error('completeSound failed', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to update sound metadata.' },
    };
  }
};
