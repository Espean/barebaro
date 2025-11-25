const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : '/api';

const state = {
  loading: false,
};

const grid = document.getElementById('sound-grid');
const emptyState = document.getElementById('empty-state');
const emptyStateDefaultHtml = emptyState ? emptyState.innerHTML : '';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatSeconds = (seconds) => {
  const total = Number(seconds) || 0;
  const mins = Math.floor(total / 60);
  const secs = Math.round(total - mins * 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
};

const formatTimestamp = (iso) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 'Ukjent tidspunkt';
  }
  try {
    return date.toLocaleString('nb-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch (error) {
    return date.toISOString();
  }
};

const fetchJson = async (path, init = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'demo-user',
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json();
};

const clearExistingCards = () => {
  if (!grid) return;
  const cards = grid.querySelectorAll('.sound-card');
  cards.forEach((card) => card.remove());
};

const hideEmptyState = () => {
  if (!emptyState) return;
  emptyState.style.display = 'none';
};

const showEmptyState = (message, options = {}) => {
  if (!emptyState) return;
  emptyState.style.display = 'block';
  if (options.useDefault && emptyStateDefaultHtml) {
    emptyState.innerHTML = emptyStateDefaultHtml;
    return;
  }
  const text = message || 'Ingen lagrede klipp enda.';
  emptyState.innerHTML = `<strong>${escapeHtml(text)}</strong>`;
};

const renderSound = (sound) => {
  if (!grid) return;

  const card = document.createElement('div');
  card.className = 'sound-card';

  const title = document.createElement('h2');
  title.innerHTML = escapeHtml(sound.displayName || sound.name || 'Uten navn');
  card.appendChild(title);

  const meta = document.createElement('p');
  const clipLength = Math.max(0, Number(sound.clipEnd) - Number(sound.clipStart));
  meta.textContent = `Varighet: ${formatSeconds(sound.duration)} | Utsnitt: ${formatSeconds(clipLength)} | Sist endret: ${formatTimestamp(sound.updatedAt)}`;
  card.appendChild(meta);

  const audioSrc = sound.downloadUrl || sound.blobUrl || null;
  if (audioSrc) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = audioSrc;
    card.appendChild(audio);
  } else {
    const info = document.createElement('p');
    info.textContent = 'Fant ikke en avspillingslenke for dette klippet.';
    card.appendChild(info);
  }

  grid.appendChild(card);
};

const loadSounds = async () => {
  if (state.loading) return;
  state.loading = true;

  try {
    showEmptyState('Laster klipp...');
    const { items = [] } = await fetchJson('/sounds');

    clearExistingCards();

    if (!items.length) {
      showEmptyState(null, { useDefault: true });
      state.loading = false;
      return;
    }

    hideEmptyState();
    items.forEach(renderSound);
  } catch (error) {
    console.error('Failed to load sounds', error);
    showEmptyState('Klarte ikke å hente klipp. Prøv å laste siden på nytt.');
  } finally {
    state.loading = false;
  }
};

document.addEventListener('DOMContentLoaded', loadSounds);
