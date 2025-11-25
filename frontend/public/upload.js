const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : '/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Klarte ikke å lese lydfilen.'));
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Ukjent filformat.'));
        return;
      }
      const [, data = ''] = result.split(',', 2);
      if (!data) {
        reject(new Error('Fant ikke lyddata.')); // surface unexpected conversion issues
        return;
      }
      resolve(data);
    };
    reader.readAsDataURL(blob);
  });

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

    const rawName = window.bareo ? window.bareo.clipName : '';
    const name = rawName ? rawName.trim() : '';
    if (!name) {
      if (window.bareo && typeof window.bareo.focusName === 'function') {
        window.bareo.focusName();
      }
      throw new Error('Gi klippet et navn før du lagrer.');
    }

    if (!window.bareo.audioUrl) {
      throw new Error('Fant ikke lydklippet. Ta opp på nytt.');
    }

    const clip = getClipData();

    if (clip.clipEnd <= clip.clipStart) {
      throw new Error('Ugyldige trim-grenser. Flytt regionen og prøv igjen.');
    }

    const blob = await fetch(window.bareo.audioUrl).then((res) => res.blob());

    const createPayload = {
      name,
      ...clip,
      contentType: blob.type || 'audio/webm',
      size: blob.size,
      data: await blobToBase64(blob),
    };

    await fetchJson(`${API_BASE}/sounds`, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    if (window.bareo) {
      window.bareo.clipName = '';
      if (typeof window.bareo.focusName === 'function') {
        window.bareo.focusName();
      }
    }

    alert('Klippet ble lagret!\nDu finner det under "Listen".');
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
