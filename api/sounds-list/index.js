const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
  try {
    const userId = req.query.userId || req.headers['x-user-id'] || 'anon';
    const tag = req.query.tag;
    const limit = parseInt(req.query.limit || '20', 10);
    const cosmos = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const container = cosmos.database(process.env.COSMOS_DATABASE).container(process.env.COSMOS_CONTAINER);

    // Basic query (tag filter inline if provided)
    let query = 'SELECT * FROM c WHERE c.userId = @userId';
    const parameters = [{ name: '@userId', value: userId }];
    if (tag) { query += ' AND ARRAY_CONTAINS(c.tags, @tag)'; parameters.push({ name: '@tag', value: tag }); }
    query += ' ORDER BY c.uploadedAt DESC';

    const { resources } = await container.items.query({ query, parameters }, { maxItemCount: limit }).fetchAll();
    context.res = { status: 200, body: resources };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: 'list failed' };
  }
};
