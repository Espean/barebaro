import React, { useState, useRef } from 'react';
import WavesurferPlayer from '@wavesurfer/react';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [name, setName] = useState('');
  const [showNameForm, setShowNameForm] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const waveSurferRef = useRef(null);
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

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('file', recordedBlob, name ? name + '.wav' : 'opptak.wav');
    formData.append('name', name);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Opplasting feilet');
      alert('Opptaket ble lagret!');
    } catch (err) {
      alert('Feil under opplasting: ' + err.message);
    }
    setShowNameForm(false);
    setName('');
    setRecordedBlob(null);
  };

  // When waveform is ready, get duration and set region
  const handleWaveSurferReady = (ws) => {
    waveSurferRef.current = ws;
    const duration = ws.getDuration();
    setAudioDuration(duration);
    setTrimStart(0);
    setTrimEnd(duration);
  };

  // Play only the selected region
  const handlePlayRegion = () => {
    if (waveSurferRef.current) {
      waveSurferRef.current.play(trimStart, trimEnd);
      setIsPlaying(true);
      waveSurferRef.current.once('pause', () => setIsPlaying(false));
      waveSurferRef.current.once('finish', () => setIsPlaying(false));
    }
  };

  // Record new
  const handleRecordNew = () => {
    setRecordedBlob(null);
    setShowNameForm(false);
    setName('');
    setTrimStart(0);
    setTrimEnd(0);
    setAudioDuration(0);
  };

  // Slider handlers
  const handleSliderChange = (which, value) => {
    value = Math.max(0, Math.min(audioDuration, value));
    if (which === 'start') {
      setTrimStart(Math.min(value, trimEnd - 0.01));
    } else {
      setTrimEnd(Math.max(value, trimStart + 0.01));
    }
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
      <h1 style={{ fontSize: 48, fontWeight: 700, color: '#2d3a4b', marginBottom: 40 }}>
        Barebaros lyd
      </h1>

      {!isRecording && !showNameForm && (
        <button onClick={startRecording} style={{
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          color: '#fff', border: 'none', borderRadius: 50,
          padding: '24px 64px', fontSize: 28, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(102,126,234,0.2)',
          cursor: 'pointer', transition: 'background 0.2s', marginBottom: 32
        }}>
          Start opptak
        </button>
      )}

      {isRecording && (
        <>
          <div style={{ fontSize: 22, color: '#764ba2', marginBottom: 16 }}>
            Opptak pågår...
          </div>
          <button onClick={stopRecording} style={{
            background: 'linear-gradient(90deg, #ff5858 0%, #f09819 100%)',
            color: '#fff', border: 'none', borderRadius: 50,
            padding: '20px 56px', fontSize: 24, fontWeight: 600,
            boxShadow: '0 8px 32px rgba(255,88,88,0.15)',
            cursor: 'pointer', transition: 'background 0.2s', marginBottom: 32
          }}>
            Stopp
          </button>
        </>
      )}

      {showNameForm && recordedBlob && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 400, marginBottom: 16 }}>
            <WavesurferPlayer
              height={80}
              waveColor="#43cea2"
              progressColor="#185a9d"
              url={URL.createObjectURL(recordedBlob)}
              onReady={handleWaveSurferReady}
            />
            {audioDuration > 0 && (
              <div style={{ position: 'relative', height: 40, marginTop: 16 }}>
                {/* Slider track */}
                <div style={{
                  position: 'absolute', top: 18, left: 0, right: 0, height: 4,
                  background: '#eee', borderRadius: 2
                }} />
                {/* Selected region */}
                <div style={{
                  position: 'absolute',
                  top: 18,
                  left: `${(trimStart / audioDuration) * 100}%`,
                  width: `${((trimEnd - trimStart) / audioDuration) * 100}%`,
                  height: 4,
                  background: '#43cea2',
                  borderRadius: 2,
                  zIndex: 2
                }} />
                {/* Start handle */}
                <input
                  type="range"
                  min={0}
                  max={audioDuration}
                  step={0.01}
                  value={trimStart}
                  onChange={e => handleSliderChange('start', parseFloat(e.target.value))}
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: '100%',
                    zIndex: 3,
                    pointerEvents: 'auto',
                    accentColor: '#43cea2'
                  }}
                />
                {/* End handle */}
                <input
                  type="range"
                  min={0}
                  max={audioDuration}
                  step={0.01}
                  value={trimEnd}
                  onChange={e => handleSliderChange('end', parseFloat(e.target.value))}
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: '100%',
                    zIndex: 4,
                    pointerEvents: 'auto',
                    accentColor: '#185a9d'
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, gap: 12 }}>
              <button
                type="button"
                onClick={handlePlayRegion}
                disabled={isPlaying}
                style={{
                  background: isPlaying
                    ? 'linear-gradient(90deg, #bdbdbd 0%, #bdbdbd 100%)'
                    : 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 50,
                  padding: '8px 32px',
                  fontSize: 18,
                  fontWeight: 600,
                  cursor: isPlaying ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                ▶ Spill av valgt område
              </button>
              <button
                type="button"
                onClick={handleRecordNew}
                style={{
                  background: 'linear-gradient(90deg, #ff5858 0%, #f09819 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 50,
                  padding: '8px 32px',
                  fontSize: 18,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Ta opp nytt
              </button>
            </div>
            <div style={{ fontSize: 16, color: '#555', marginTop: 8 }}>
              Start: {isFinite(trimStart) ? trimStart.toFixed(2) : '0.00'}s &nbsp; | &nbsp; Slutt: {isFinite(trimEnd) ? trimEnd.toFixed(2) : '0.00'}s
            </div>
            <div style={{ fontSize: 14, color: '#888', marginTop: 2 }}>
              Dra i håndtakene for å velge ønsket del av opptaket.
            </div>
          </div>

          <input
            type="text"
            placeholder="Gi opptaket et navn..."
            value={name}
            onChange={handleNameChange}
            required
            style={{
              fontSize: 20, padding: '12px 24px',
              borderRadius: 8, border: '1px solid #ccc',
              marginBottom: 8, width: 300
            }}
          />

          <button type="submit" style={{
            background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
            color: '#fff', border: 'none', borderRadius: 50,
            padding: '16px 48px', fontSize: 22, fontWeight: 600,
            boxShadow: '0 8px 32px rgba(67,206,162,0.15)',
            cursor: 'pointer', transition: 'background 0.2s'
          }}>
            Lagre opptak
          </button>
        </form>
      )}
    </div>
  );
}

export default App;
