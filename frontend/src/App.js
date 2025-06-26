import React, { useState, useRef } from 'react';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [name, setName] = useState('');
  const [showNameForm, setShowNameForm] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new window.MediaRecorder(stream);
    audioChunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setRecordedBlob(blob);
      setShowNameForm(true);
    };
    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleNameChange = (e) => setName(e.target.value);

  // When audio loads, set duration and default trim range
  const handleAudioLoaded = (e) => {
    const duration = e.target.duration;
    setAudioDuration(duration);
    setTrimStart(0);
    setTrimEnd(duration);
  };

  // Trimming logic using Web Audio API
  const trimAudio = async (blob, start, end) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);
    const trimmedLength = endSample - startSample;
    const trimmedBuffer = audioCtx.createBuffer(
      audioBuffer.numberOfChannels,
      trimmedLength,
      sampleRate
    );
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      trimmedBuffer.getChannelData(ch).set(
        audioBuffer.getChannelData(ch).slice(startSample, endSample)
      );
    }
    const offlineCtx = new OfflineAudioContext(
      trimmedBuffer.numberOfChannels,
      trimmedBuffer.length,
      trimmedBuffer.sampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = trimmedBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = await audioBufferToWavBlob(renderedBuffer);
    return wavBlob;
  };

  // Helper: Convert AudioBuffer to WAV Blob
  async function audioBufferToWavBlob(buffer) {
    function encodeWAV(audioBuffer) {
      const numChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const format = 1; // PCM
      const bitDepth = 16;
      const samples = audioBuffer.length * numChannels;
      const bufferLength = 44 + samples * 2;
      const arrayBuffer = new ArrayBuffer(bufferLength);
      const view = new DataView(arrayBuffer);
      let offset = 0;
      function writeString(s) {
        for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
      }
      writeString('RIFF');
      view.setUint32(offset, 36 + samples * 2, true); offset += 4;
      writeString('WAVE');
      writeString('fmt ');
      view.setUint32(offset, 16, true); offset += 4;
      view.setUint16(offset, format, true); offset += 2;
      view.setUint16(offset, numChannels, true); offset += 2;
      view.setUint32(offset, sampleRate, true); offset += 4;
      view.setUint32(offset, sampleRate * numChannels * bitDepth / 8, true); offset += 4;
      view.setUint16(offset, numChannels * bitDepth / 8, true); offset += 2;
      view.setUint16(offset, bitDepth, true); offset += 2;
      writeString('data');
      view.setUint32(offset, samples * 2, true); offset += 4;
      for (let i = 0; i < audioBuffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          let sample = audioBuffer.getChannelData(ch)[i];
          sample = Math.max(-1, Math.min(1, sample));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }
      return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
    return encodeWAV(buffer);
  }

  const handleSave = async (e) => {
    e.preventDefault();
    let blobToSave = recordedBlob;
    if (audioDuration > 0 && (trimStart > 0 || trimEnd < audioDuration)) {
      blobToSave = await trimAudio(recordedBlob, trimStart, trimEnd);
    }
    // TODO: Upload logic here, use blobToSave
    setShowNameForm(false);
    setName('');
    setRecordedBlob(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Segoe UI, sans-serif'
    }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: '#2d3a4b', marginBottom: 40 }}>Barebaros lyd</h1>
      {!isRecording && !showNameForm && (
        <button
          onClick={startRecording}
          style={{
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 50,
            padding: '24px 64px',
            fontSize: 28,
            fontWeight: 600,
            boxShadow: '0 8px 32px rgba(102,126,234,0.2)',
            cursor: 'pointer',
            transition: 'background 0.2s',
            marginBottom: 32
          }}
        >
          Start opptak
        </button>
      )}
      {isRecording && (
        <>
          <div style={{ fontSize: 22, color: '#764ba2', marginBottom: 16 }}>Opptak pågår...</div>
          <button
            onClick={stopRecording}
            style={{
              background: 'linear-gradient(90deg, #ff5858 0%, #f09819 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              padding: '20px 56px',
              fontSize: 24,
              fontWeight: 600,
              boxShadow: '0 8px 32px rgba(255,88,88,0.15)',
              cursor: 'pointer',
              transition: 'background 0.2s',
              marginBottom: 32
            }}
          >
            Stopp
          </button>
        </>
      )}
      {showNameForm && recordedBlob && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <audio
            ref={audioRef}
            controls
            src={URL.createObjectURL(recordedBlob)}
            style={{ marginBottom: 16 }}
            onLoadedMetadata={handleAudioLoaded}
          />
          {audioDuration > 0 && (
            <div style={{ width: 320, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#555' }}>
                <span>Start: {trimStart.toFixed(2)}s</span>
                <span>Slutt: {trimEnd.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={audioDuration}
                step={0.01}
                value={trimStart}
                onChange={e => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.01))}
                style={{ width: '100%', marginBottom: 8 }}
              />
              <input
                type="range"
                min={0}
                max={audioDuration}
                step={0.01}
                value={trimEnd}
                onChange={e => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.01))}
                style={{ width: '100%' }}
              />
            </div>
          )}
          <input
            type="text"
            placeholder="Gi opptaket et navn..."
            value={name}
            onChange={handleNameChange}
            required
            style={{
              fontSize: 20,
              padding: '12px 24px',
              borderRadius: 8,
              border: '1px solid #ccc',
              marginBottom: 8,
              width: 300
            }}
          />
          <button
            type="submit"
            style={{
              background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              padding: '16px 48px',
              fontSize: 22,
              fontWeight: 600,
              boxShadow: '0 8px 32px rgba(67,206,162,0.15)',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Lagre opptak
          </button>
        </form>
      )}
    </div>
  );
}

export default App;
