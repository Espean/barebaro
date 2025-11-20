'use strict';

const { v4: uuid } = require('uuid');
const { getCosmosContainer, createUploadSas } = require('../shared/clients');
const { getUserId, audioContainer, storageUrl } = require('../shared/config');

const parseNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = async function createSound(context, req) {
  try {
    if (!req.body) {
      context.res = {
        status: 400,
        body: { error: 'Request body is required.' },
      };
      return;
    }

    const userId = getUserId(req);
    const name = (req.body.name || '').trim();
    const clipStart = parseNumber(req.body.clipStart, 0);
    const clipEnd = parseNumber(req.body.clipEnd, 0);
    const duration = parseNumber(req.body.duration, 0);
    const contentType = (req.body.contentType || 'audio/webm').toLowerCase();

    if (!name) {
      context.res = {
        status: 400,
        body: { error: 'A name is required to store the clip.' },
      };
      return;
    }

    if (clipEnd <= clipStart) {
      context.res = {
        status: 400,
        body: { error: 'clipEnd must be greater than clipStart.' },
      };
      return;
    }

    const container = getCosmosContainer();
    const soundId = uuid();
    const safeExt = contentType.includes('mp3')
      ? 'mp3'
      : contentType.includes('wav')
      ? 'wav'
      : contentType.includes('ogg')
      ? 'ogg'
      : 'webm';

    const blobName = `${userId}/${soundId}.${safeExt}`;

    const nowIso = new Date().toISOString();
    const item = {
      id: soundId,
      userId,
      name,
      clipStart,
      clipEnd,
      duration,
      contentType,
      blobName,
      blobUrl: `${storageUrl().replace(/\/$/, '')}/${audioContainer()}/${blobName}`,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await container.items.create(item);

    const uploadUrl = createUploadSas({ blobName, contentType });

    context.res = {
      status: 201,
      body: {
        message: 'Sound metadata created. Upload using the provided SAS URL within 15 minutes.',
        sound: item,
        uploadUrl,
      },
    };
  } catch (error) {
    context.log.error('createSound failed', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to create sound metadata.' },
    };
  }
};
