import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { trimBlobToWav } from './audioUtils';

const API_BASE = '/api'; // Static Web App proxy to Functions

export default function RecordPage({ onBack, onBrowse }) {
  const wavesurferRef = useRef(null);
  const containerRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [region, setRegion] = useState(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4f71ff',
      progressColor: '#1d3fb3',
      height: 160,
      responsive: true
    });
    const regions = ws.registerPlugin(RegionsPlugin.create());
    regions.on('region-updated', r => setRegion({ start: r.start, end: r.end }));
    regions.on('region-created', r => setRegion({ start: r.start, end: r.end }));
    wavesurferRef.current = ws;
    return () => ws.destroy();
  }, []);

  const startRecording = async () => {
    setError(null);
    setSuccess(false);
    setChunks([]);
    setAudioBlob(null);
    setRegion(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = e => setChunks(prev => [...prev, e.data]);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        loadBlobIntoWaveform(blob);
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      setError(e.message || 'Failed to access microphone');
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    setRecording(false);
  };

  const loadBlobIntoWaveform = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    wavesurferRef.current.loadBlob(new Blob([arrayBuffer]));
    wavesurferRef.current.on('ready', () => {
      setDuration(wavesurferRef.current.getDuration());
    });
  };

  const addSelectionRegion = () => {
    if (!wavesurferRef.current) return;
    const ws = wavesurferRef.current;
    const regionsPlugin = ws.getActivePlugins().regions;
    regionsPlugin.clear();
    const dur = ws.getDuration();
    const start = 0;
    const end = Math.min(dur, dur); // initially full
    regionsPlugin.addRegion({ start, end, color: 'rgba(255,165,0,0.3)' });
    setRegion({ start, end });
  };

  const saveTrimmed = async () => {
    if (!audioBlob) {
      setError('No audio to save');
      return;
    }
    if (!name.trim()) {
      setError('Gi lyden et navn');
      return;
    }
    setError(null);
    setUploading(true);
    setSuccess(false);
    try {
      // Step 1: request init-upload (SAS + metadata doc creation)
      const initRes = await fetch(`${API_BASE}/sounds-init-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: name.trim(),
          contentType: 'audio/wav',
          userId: 'demo-user',
          title: name.trim()
        })
      });
      if (!initRes.ok) throw new Error('Init upload failed');
      const initData = await initRes.json();
      const { uploadUrl, id } = initData;

      // Step 2: create trimmed WAV blob
      let start = 0, end = duration;
      if (region) { start = region.start; end = region.end; }
      const trimmedBlob = await trimBlobToWav(audioBlob, start, end);

      // Step 3: PUT to SAS URL
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'audio/wav' },
        body: trimmedBlob
      });
      if (!putRes.ok) throw new Error('Failed to upload trimmed blob');

      // Step 4: complete upload (store final metadata incl. selection)
      const completeRes = await fetch(`${API_BASE}/sounds-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          userId: 'demo-user',
          startSeconds: start,
            endSeconds: end,
          durationSeconds: end - start
        })
      });
      if (!completeRes.ok) throw new Error('Complete upload failed');

      setSuccess(true);
      setTimeout(()=> onBrowse(), 800);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <button onClick={onBack}>Tilbake</button>{' '}<button onClick={onBrowse}>Lytte</button>
      <h2>Record lyd</h2>
      <div style={{ marginBottom: 16 }}>
        {!recording && <button className="record-btn" onClick={startRecording}>Start opptak</button>}
        {recording && <button className="record-btn" onClick={stopRecording}>Stopp</button>}
        {audioBlob && <button onClick={addSelectionRegion}>Marker område</button>}
      </div>
      <div ref={containerRef} style={{ width: '100%', background:'#111', borderRadius:8 }} />
      {audioBlob && (
        <div style={{ marginTop:16 }}>
          <input
            placeholder="Navn på lyd"
            value={name}
            onChange={e=>setName(e.target.value)}
            style={{ padding:8, minWidth:240 }}
          />{' '}
          <button disabled={uploading} onClick={saveTrimmed}>Lagre</button>
        </div>
      )}
      {region && (
        <div style={{ fontSize:12, marginTop:8 }}>Valgt: {region.start.toFixed(2)}s - {region.end.toFixed(2)}s ({(region.end-region.start).toFixed(2)}s)</div>
      )}
      {uploading && <div>Opplaster...</div>}
      {error && <div style={{ color:'red' }}>{error}</div>}
      {success && <div style={{ color:'green' }}>Lagret!</div>}
    </div>
  );
}
