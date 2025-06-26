import React, { useState, useRef } from 'react';

function App() {
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
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
      setRecordings((prev) => [...prev, blob]);
    };
    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const deleteRecording = (idx) => {
    setRecordings((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadRecording = async (blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    await fetch('/api/upload', { method: 'POST', body: formData });
  };

  return (
    <div style={{ maxWidth: 600, margin: 'auto', padding: 32 }}>
      <h1>Barebaro Sound Recorder</h1>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      <h2>Recordings</h2>
      <ul>
        {recordings.map((blob, idx) => (
          <li key={idx}>
            <audio controls src={URL.createObjectURL(blob)} />
            <button onClick={() => uploadRecording(blob)}>Upload</button>
            <button onClick={() => deleteRecording(idx)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
