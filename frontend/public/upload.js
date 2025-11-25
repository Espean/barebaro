const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : '/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let statusElement;

const ensureStatusElement = () => {
  if (statusElement && document.body.contains(statusElement)) {
    return statusElement;
  }
  const existing = document.getElementById('upload-status');
  if (existing) {
    statusElement = existing;
    return statusElement;
  }
  const wrapper = document.querySelector('.waveform-wrapper');
  const el = document.createElement('div');
  el.id = 'upload-status';
  el.className = 'upload-status';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  (wrapper || document.body).appendChild(el);
  statusElement = el;
  return statusElement;
};

const setStatus = (message, type = 'info') => {
  const el = ensureStatusElement();
  if (!el) return;
  if (!message) {
    el.textContent = '';
    el.style.display = 'none';
    el.removeAttribute('data-type');
    return;
  }
  el.textContent = message;
  el.dataset.type = type;
  el.style.display = 'block';
};

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

const createAudioContext = () => {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    throw new Error('Nettleseren støtter ikke lydredigering.');
  }
  return new Ctor();
};

const decodeAudioBlob = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = createAudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    return audioBuffer;
  } catch (error) {
    await audioContext.close().catch(() => {});
    throw error;
  }
};

const trimAudioBuffer = (audioBuffer, start, end) => {
  const sampleRate = audioBuffer.sampleRate;
  const safeStart = Math.max(0, Math.min(start, audioBuffer.duration));
  const safeEnd = Math.max(safeStart + 1 / sampleRate, Math.min(end, audioBuffer.duration));
  const startFrame = Math.floor(safeStart * sampleRate);
  const endFrame = Math.floor(safeEnd * sampleRate);
  const frameCount = Math.max(1, endFrame - startFrame);
  let trimmed;
  if (typeof AudioBuffer === 'function') {
    trimmed = new AudioBuffer({
      length: frameCount,
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate,
    });
  } else {
    const tempContext = createAudioContext();
    trimmed = tempContext.createBuffer(audioBuffer.numberOfChannels, frameCount, sampleRate);
    tempContext.close().catch(() => {});
  }

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const sourceData = audioBuffer.getChannelData(channel);
    const slice = sourceData.slice(startFrame, startFrame + frameCount);
    if (typeof trimmed.copyToChannel === 'function') {
      trimmed.copyToChannel(slice, channel, 0);
    } else {
      trimmed.getChannelData(channel).set(slice);
    }
  }

  return trimmed;
};

const audioBufferToWav = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels || 1;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples * blockAlign);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + samples * blockAlign, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, samples * blockAlign, true);
  offset += 4;

  const channelData = [];
  for (let channel = 0; channel < numChannels; channel += 1) {
    channelData.push(audioBuffer.getChannelData(channel));
  }

  for (let i = 0; i < samples; i += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      let sample = channelData[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return buffer;
};

const createTrimmedClipBlob = async (blob, clipStart, clipEnd) => {
  const audioBuffer = await decodeAudioBlob(blob);
  const trimmedBuffer = trimAudioBuffer(audioBuffer, clipStart, clipEnd);
  const wavArrayBuffer = audioBufferToWav(trimmedBuffer);
  return new Blob([wavArrayBuffer], { type: 'audio/wav' });
};

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
    setStatus('');

    const rawName = window.bareo ? window.bareo.clipName : '';
    const name = rawName ? rawName.trim() : '';
    if (!name) {
      if (window.bareo && typeof window.bareo.focusName === 'function') {
        window.bareo.focusName();
      }
      throw new Error('Gi klippet et navn før du lagrer.');
    }

    if (!window.bareo.audioUrl && !window.bareo.recordedBlob) {
      throw new Error('Fant ikke lydklippet. Ta opp på nytt.');
    }

    const clip = getClipData();

    if (clip.clipEnd <= clip.clipStart) {
      throw new Error('Ugyldige trim-grenser. Flytt regionen og prøv igjen.');
    }

    const sourceBlob = window.bareo.recordedBlob
      ? window.bareo.recordedBlob
      : await fetch(window.bareo.audioUrl).then((res) => res.blob());

    setStatus('Forbereder klippet …');
    const trimmedBlob = await createTrimmedClipBlob(sourceBlob, clip.clipStart, clip.clipEnd);

    const createPayload = {
      name,
      ...clip,
      contentType: trimmedBlob.type || 'audio/wav',
      size: trimmedBlob.size,
      data: await blobToBase64(trimmedBlob),
    };

    setStatus('Lagrer klippet …');
    await fetchJson(`${API_BASE}/sounds`, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    if (window.bareo) {
      window.bareo.clipName = '';
      window.bareo.recordedBlob = null;
      if (typeof window.bareo.focusName === 'function') {
        window.bareo.focusName();
      }
    }

    setStatus('Klippet ble lagret. Du finner det under "Listen".', 'success');
  } catch (error) {
    console.error('Upload failed', error);
    setStatus(error.message || 'Klarte ikke å lagre klippet.', 'error');
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

const resetStatus = () => setStatus('');

document.getElementById('reset')?.addEventListener('click', resetStatus);
