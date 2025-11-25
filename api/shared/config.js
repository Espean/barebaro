'use strict';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const optional = (name) => process.env[name];

const pickFirst = (value) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const parsePrincipal = (raw) => {
  if (!raw) {
    return null;
  }
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
};

const getClientPrincipal = (req) => {
  const header = pickFirst(req?.headers?.['x-ms-client-principal'] || req?.headers?.['X-MS-CLIENT-PRINCIPAL']);
  return parsePrincipal(header);
};

const findClaimValue = (principal, types = []) => {
  if (!principal?.claims?.length) {
    return undefined;
  }
  for (const type of types) {
    const match = principal.claims.find((claim) => claim.typ === type || claim.type === type);
    if (match) {
      return match.val || match.value;
    }
  }
  return undefined;
};

const getUserId = (req) => {
  const principal = getClientPrincipal(req);
  if (principal) {
    const candidate =
      principal.userId ||
      findClaimValue(principal, [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
        'http://schemas.microsoft.com/identity/claims/objectidentifier',
        'oid',
        'sub',
      ]);
    if (candidate) {
      return String(candidate);
    }
  }

  const headerId = pickFirst(req?.headers?.['x-user-id'] || req?.headers?.['X-User-Id']);
  if (headerId) {
    return String(headerId);
  }
  if (req?.query?.userId) {
    return String(req.query.userId);
  }
  if (req?.body?.userId) {
    return String(req.body.userId);
  }
  return 'anonymous';
};

const getAllowedAdminIds = () => {
  const raw = optional('ADMIN_ALLOWED_OBJECT_IDS');
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
};

const isAdmin = (req) => {
  const allowed = getAllowedAdminIds();
  if (!allowed.length) {
    return false;
  }
  if (allowed.includes('*')) {
    return true;
  }

  const principal = getClientPrincipal(req);
  const candidates = [];

  if (principal) {
    if (principal.userId) {
      candidates.push(principal.userId);
    }
    const claimCandidates = findClaimValue(principal, [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      'http://schemas.microsoft.com/identity/claims/objectidentifier',
      'oid',
      'sub',
    ]);
    if (claimCandidates) {
      candidates.push(claimCandidates);
    }
  }

  const headerId = pickFirst(req?.headers?.['x-user-id'] || req?.headers?.['X-User-Id']);
  if (headerId) {
    candidates.push(headerId);
  }
  if (req?.query?.userId) {
    candidates.push(req.query.userId);
  }
  if (req?.body?.userId) {
    candidates.push(req.body.userId);
  }

  return candidates
    .map((value) => (value ? String(value).trim().toLowerCase() : ''))
    .some((candidate) => candidate && allowed.includes(candidate));
};

module.exports = {
  required,
  getUserId,
  isAdmin,
  audioContainer: () => required('AUDIO_CONTAINER'),
  cosmosEndpoint: () => required('COSMOS_ENDPOINT'),
  cosmosDatabase: () => required('COSMOS_DATABASE'),
  cosmosContainer: () => required('COSMOS_CONTAINER'),
  cosmosKey: () => required('COSMOS_KEY'),
  storageAccount: () => required('AUDIO_STORAGE_ACCOUNT'),
  storageKey: () => required('AUDIO_STORAGE_KEY'),
  storageUrl: () => required('AUDIO_STORAGE_URL'),
};
