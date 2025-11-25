const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : '/api';

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';

const state = {
  loading: false,
};

const players = new Map();

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
  players.forEach((player) => {
    try {
      player.destroy();
    } catch (error) {
      console.warn('Failed to destroy player', error);
    }
  });
  players.clear();
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

const stopAllExcept = (soundId) => {
  players.forEach((player, id) => {
    if (id !== soundId && player.isPlaying()) {
      player.pause();
    }
  });
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
    const playerWrapper = document.createElement('div');
    playerWrapper.className = 'player-wrapper';

    const controls = document.createElement('div');
    controls.className = 'player-controls';

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'play-btn';
    playButton.textContent = 'Spill av';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Slett';

    controls.appendChild(playButton);
    controls.appendChild(deleteButton);

    const waveform = document.createElement('div');
    waveform.className = 'waveform';

    playerWrapper.appendChild(controls);
    playerWrapper.appendChild(waveform);
    card.appendChild(playerWrapper);

    const waveSurfer = WaveSurfer.create({
      container: waveform,
      waveColor: '#43cea2',
      progressColor: '#185a9d',
      height: 56,
      barWidth: 2,
      responsive: true,
      url: audioSrc,
      interact: false,
      normalize: true,
    });

    players.set(sound.id, waveSurfer);

    const resetPlayButton = () => {
      playButton.textContent = 'Spill av';
    };

    playButton.addEventListener('click', () => {
      if (waveSurfer.isPlaying()) {
        waveSurfer.pause();
        resetPlayButton();
        return;
      }
      stopAllExcept(sound.id);
      waveSurfer.play();
      playButton.textContent = 'Pause';
    });

    waveSurfer.on('finish', resetPlayButton);
    waveSurfer.on('pause', resetPlayButton);

    deleteButton.addEventListener('click', async () => {
      const confirmed = window.confirm(`Slette klippet "${sound.displayName || sound.name}"?`);
      if (!confirmed) {
        return;
      }
      try {
        deleteButton.disabled = true;
        deleteButton.textContent = 'Sletter…';
        await fetchJson(`/sounds/${encodeURIComponent(sound.id)}`, { method: 'DELETE' });
        const player = players.get(sound.id);
        if (player) {
          try {
            player.destroy();
          } catch (error) {
            console.warn('Failed to destroy player', error);
          }
          players.delete(sound.id);
        }
        card.remove();
        if (!grid.querySelector('.sound-card')) {
          showEmptyState(null, { useDefault: true });
        }
      } catch (error) {
        console.error('Failed to delete sound', error);
        deleteButton.disabled = false;
        deleteButton.textContent = 'Slett';
        window.alert('Klarte ikke å slette klippet. Prøv igjen.');
      }
    });
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
