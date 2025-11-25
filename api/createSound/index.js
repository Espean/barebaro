'use strict';

const nodeCrypto = require('crypto');

if (!globalThis.crypto && nodeCrypto.webcrypto) {
  globalThis.crypto = nodeCrypto.webcrypto;
}

const { randomUUID } = nodeCrypto;
const { getCosmosContainer, getBlobServiceClient } = require('../shared/clients');
const { getUserId, audioContainer, storageUrl } = require('../shared/config');

const parseNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

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
    const declaredSize = parseNumber(req.body.size, 0);
    const base64Data = typeof req.body.data === 'string' ? req.body.data.trim() : '';

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

    if (!base64Data) {
      context.res = {
        status: 400,
        body: { error: 'Audio payload is required.' },
      };
      return;
    }

    let buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch (err) {
      context.log.warn('createSound invalid base64 payload', err);
      context.res = {
        status: 400,
        body: { error: 'Invalid audio payload.' },
      };
      return;
    }

    if (!buffer || buffer.length === 0) {
      context.res = {
        status: 400,
        body: { error: 'Audio payload is empty.' },
      };
      return;
    }

    const container = getCosmosContainer();
    const soundId = randomUUID();
    const safeExt = contentType.includes('mp3')
      ? 'mp3'
      : contentType.includes('wav')
      ? 'wav'
      : contentType.includes('ogg')
      ? 'ogg'
      : 'webm';
    const nameSlug = slugify(name);
    const baseFileName = nameSlug ? `${nameSlug}-${soundId}` : soundId;
    const fileName = `${baseFileName}.${safeExt}`;
    const blobName = `${userId}/${fileName}`;

    const blobService = getBlobServiceClient();
    const containerClient = blobService.getContainerClient(audioContainer());
    await containerClient.createIfNotExists();

    const blobClient = containerClient.getBlockBlobClient(blobName);

    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
      metadata: {
        userid: userId,
        soundid: soundId,
      },
    });

    const size = declaredSize > 0 ? declaredSize : buffer.length;
    const nowIso = new Date().toISOString();
    const item = {
      id: soundId,
      userId,
      name,
      displayName: name,
      clipStart,
      clipEnd,
      duration,
      contentType,
      blobName,
      fileName,
      blobUrl: `${storageUrl().replace(/\/$/, '')}/${audioContainer()}/${blobName}`,
      status: 'ready',
      createdAt: nowIso,
      updatedAt: nowIso,
      size,
    };

    await container.items.create(item);

    context.res = {
      status: 201,
      body: {
        message: 'Sound stored successfully.',
        sound: item,
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
