import React, { useState, useRef } from 'react';
import WaveSurfer from 'wavesurfer-react';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [name, setName] = useState('');
  const [showNameForm, setShowNameForm] = useState(false);
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
    // Upload logic
    const formData = new FormData();
    formData.append('file', recordedBlob, name ? name + '.wav' : 'opptak.wav');
    formData.append('name', name);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Opplasting feilet');
      alert('Opptaket ble lagret!');
    } catch (err) {
      alert('Feil under opplasting: ' + err.message);
    }
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
          <div style={{ width: 400, marginBottom: 16 }}>
            {recordedBlob ? (
              <WaveSurfer
                height={80}
                waveColor="#43cea2"
                progressColor="#185a9d"
                url={URL.createObjectURL(recordedBlob)}
              />
            ) : (
              <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>Ingen lydopptak funnet.</div>
            )}
          </div>
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
