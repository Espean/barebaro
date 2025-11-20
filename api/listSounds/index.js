'use strict';

const { getCosmosContainer } = require('../shared/clients');
const { getUserId } = require('../shared/config');

module.exports = async function listSounds(context, req) {
  try {
    const userId = getUserId(req);
    const container = getCosmosContainer();

    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.status != @deleted ORDER BY c.updatedAt DESC',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@deleted', value: 'deleted' },
      ],
    };

    const { resources } = await container.items.query(querySpec, { partitionKey: userId }).fetchAll();

    context.res = {
      status: 200,
      body: {
        items: resources,
      },
    };
  } catch (error) {
    context.log.error('listSounds failed', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to list stored sounds.' },
    };
  }
};
