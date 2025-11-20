const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : '/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'demo-user',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return res.json();
};

const ensureWave = () => {
  if (!window.bareo || !window.bareo.ws || !window.bareo.regions) {
    throw new Error('Recorder not ready yet. Record something first.');
  }
};

const getClipData = () => {
  const { regions, duration } = window.bareo;
  const list = regions.getRegions();
  if (!list.length) {
    throw new Error('No region found. Adjust the green area first.');
  }
  const r = list[0];
  return {
    clipStart: Number(r.start.toFixed(3)),
    clipEnd: Number(r.end.toFixed(3)),
    duration: Number(duration.toFixed(3)),
  };
};

const uploadRecording = async () => {
  try {
    ensureWave();

    const name = prompt('Gi klippet et navn');
    if (!name || !name.trim()) {
      return;
    }

    if (!window.bareo.audioUrl) {
      throw new Error('Fant ikke lydklippet. Ta opp på nytt.');
    }

    const clip = getClipData();

    if (clip.clipEnd <= clip.clipStart) {
      throw new Error('Ugyldige trim-grenser. Flytt regionen og prøv igjen.');
    }

    const createPayload = {
      name: name.trim(),
      ...clip,
      contentType: 'audio/webm',
    };

    const createResponse = await fetchJson(`${API_BASE}/sounds`, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    const { uploadUrl, sound } = createResponse;

    const blob = await fetch(window.bareo.audioUrl).then((res) => res.blob());

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type || 'audio/webm',
      },
      body: blob,
    });

    if (!putRes.ok) {
      await fetchJson(`${API_BASE}/sounds/${sound.id}`, { method: 'DELETE' }).catch(() => {});
      throw new Error('Opplasting feilet. Prøv igjen.');
    }

    await fetchJson(`${API_BASE}/sounds/${sound.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        status: 'ready',
        size: blob.size,
      }),
    });

    alert('Klippet ble lagret!
Du finner det under "Listen".');
  } catch (error) {
    console.error('Upload failed', error);
    alert(error.message || 'Klarte ikke å lagre klippet.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Lagrer…';
    try {
      await uploadRecording();
    } finally {
      await sleep(300);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lagre klipp';
    }
  });
});
