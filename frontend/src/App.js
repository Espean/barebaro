import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showFormIdx, setShowFormIdx] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: '' });
  const [cloudRecordings, setCloudRecordings] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const fetchCloudRecordings = () => {
    fetch('/api/list')
      .then(res => res.json())
      .then(setCloudRecordings);
  };

  useEffect(() => {
    fetchCloudRecordings();
  }, []);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new window.MediaRecorder(stream);
    audioChunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setRecordings((prev) => [...prev, { blob, name: '', category: '' }]);
      setShowFormIdx(recordings.length); // show form for the new recording
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
    setShowFormIdx(null);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const saveRecording = async (idx) => {
    const { blob } = recordings[idx];
    const data = new FormData();
    data.append('file', blob, 'recording.webm');
    data.append('name', formData.name);
    data.append('category', formData.category);
    await fetch('/api/upload', { method: 'POST', body: data });
    setRecordings((prev) => prev.map((rec, i) => i === idx ? { ...rec, name: formData.name, category: formData.category } : rec));
    setShowFormIdx(null);
    setFormData({ name: '', category: '' });
    fetchCloudRecordings(); // Refresh the cloud recordings list after save
  };

  return (
    <div style={{ maxWidth: 600, margin: 'auto', padding: 32 }}>
      <h1>Barebaro Sound Recorder</h1>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      <h2>Recordings (Not yet uploaded)</h2>
      <ul>
        {recordings.map((rec, idx) => (
          <li key={idx}>
            <audio controls src={URL.createObjectURL(rec.blob)} />
            {showFormIdx === idx ? (
              <form onSubmit={e => { e.preventDefault(); saveRecording(idx); }}>
                <input name="name" placeholder="Name" value={formData.name} onChange={handleFormChange} required />
                <input name="category" placeholder="Category" value={formData.category} onChange={handleFormChange} required />
                <button type="submit">Save</button>
                <button type="button" onClick={() => deleteRecording(idx)}>Delete</button>
              </form>
            ) : (
              <>
                <span>{rec.name && `Name: ${rec.name} `}</span>
                <span>{rec.category && `Category: ${rec.category}`}</span>
                <button onClick={() => setShowFormIdx(idx)}>Edit</button>
                <button onClick={() => deleteRecording(idx)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <h2>Saved Recordings</h2>
      <ul>
        {cloudRecordings.map((rec, idx) => (
          <li key={rec.rowKey}>
            <span>Name: {rec.name} </span>
            <span>Category: {rec.category} </span>
            <span>Size: {rec.size} bytes </span>
            <span>Uploaded: {rec.uploadTime} </span>
            {/* TODO: Add playback, delete, edit actions */}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
