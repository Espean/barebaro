import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : '/api';

const state = {
  loading: false,
  identityLoaded: false,
};

const players = new Map();

const grid = document.getElementById('admin-grid');
const emptyState = document.getElementById('admin-empty');
const statusBanner = document.getElementById('admin-status');
const userInfo = document.getElementById('admin-user');

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

const setStatus = (message, type = 'info') => {
  if (!statusBanner) return;
  if (!message) {
    statusBanner.style.display = 'none';
    statusBanner.textContent = '';
    statusBanner.removeAttribute('data-type');
    return;
  }
  statusBanner.textContent = message;
  statusBanner.dataset.type = type;
  statusBanner.style.display = 'block';
};

const setUserInfo = (principal) => {
  if (!userInfo) return;
  if (!principal) {
    userInfo.textContent = 'Klarte ikke å hente brukerinfo. Forsøk å logge inn på nytt.';
    return;
  }
  const name = principal.userDetails || principal.identityProvider || 'Innlogget bruker';
  const id = principal.userId || '';
  userInfo.innerHTML = `Innlogget som <strong>${escapeHtml(name)}</strong>${id ? ` (ID: ${escapeHtml(id)})` : ''}`;
};

const loadIdentity = async () => {
  try {
    const response = await fetch('/.auth/me', { credentials: 'include' });
    if (!response.ok) {
      setStatus('Kun innloggede brukere har tilgang til denne siden.', 'error');
      return;
    }
    const payload = await response.json();
    const principal = payload?.clientPrincipal || null;
    if (!principal) {
      setStatus('Fant ingen innlogget bruker. Logg inn via Entra ID.', 'error');
      return;
    }
    state.identityLoaded = true;
    setUserInfo(principal);
  } catch (error) {
    console.error('Failed to load identity', error);
    setStatus('Kunne ikke hente brukerinfo. Forsøk på nytt.', 'error');
  }
};

const fetchJson = async (path, init = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
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

const showEmptyState = () => {
  if (!emptyState) return;
  emptyState.style.display = 'block';
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

    const waveform = document.createElement('div');
    waveform.className = 'waveform';
    playerWrapper.appendChild(waveform);

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
    playerWrapper.appendChild(controls);
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
      try {
        setStatus(`Sletter "${sound.displayName || sound.name}" …`);
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
          showEmptyState();
        }
        setStatus('Klippet ble slettet.', 'success');
      } catch (error) {
        console.error('Failed to delete sound', error);
        deleteButton.disabled = false;
        deleteButton.textContent = 'Slett';
        setStatus(error.message || 'Klarte ikke å slette klippet.', 'error');
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
    setStatus('Laster klipp …');
    const { items = [] } = await fetchJson('/sounds');

    clearExistingCards();

    if (!items.length) {
      showEmptyState();
      setStatus('Ingen klipp funnet for brukeren.', 'info');
      state.loading = false;
      return;
    }

    hideEmptyState();
    items.forEach(renderSound);
    setStatus('Klippene er klare. Spill av eller slett etter behov.', 'success');
  } catch (error) {
    console.error('Failed to load sounds', error);
    showEmptyState();
    setStatus(error.message || 'Klarte ikke å hente klipp. Prøv igjen.', 'error');
  } finally {
    state.loading = false;
  }
};

const init = async () => {
  await loadIdentity();
  await loadSounds();
};

document.addEventListener('DOMContentLoaded', init);
