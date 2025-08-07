import React, { useRef, useState, useEffect } from "react";
import '@wavesurfer/web-component';

// This component demonstrates how to use the Wavesurfer Web Component inside a
// React application.  It records audio, loads the recorded blob into
// <wave-surfer>, and exposes a single draggable region.  The region handles
// are styled via the ::part selectors defined in the accompanying CSS file
// (see waveSurfer.css).  Switching to the Web Component allows us to style
// internal parts without resorting to complex JavaScript hacks or
// MutationObservers.

export default function App() {
  const waveRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // When audioUrl changes, update the src attribute on the web component.
  useEffect(() => {
    if (audioUrl && waveRef.current) {
      waveRef.current.setAttribute('src', audioUrl);
    }
  }, [audioUrl]);

  // Handle start/stop recording.  Uses the MediaRecorder API to capture
  // microphone input and construct a Blob, then converts it to an object
  // URL which <wave-surfer> can load.  Once recording stops, the region
  // element is updated to cover the full duration of the recorded audio.
  const handleRecordToggle = async () => {
    if (!isRecording) {
      setIsRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new window.MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setIsRecording(false);
      };
      mediaRecorderRef.current.start();
    } else {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Reset the recording and clear any existing region/audio
  const handleReset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setIsRecording(false);
  };

  // After the web component has loaded the audio (fires when the waveform
  // finishes decoding), set up a single region that spans the entire audio
  // duration.  We listen for the custom event "decode" dispatched by the
  // <wave-surfer> element.
  useEffect(() => {
    const waveEl = waveRef.current;
    if (!waveEl) return;
    const onDecode = () => {
      // Remove any existing regions
      waveEl.regions?.clearRegions?.();
      const duration = waveEl.duration || 0;
      // Add a region spanning the full duration.  The id attribute is used
      // to reference the region later if needed.
      waveEl.addRegion({
        start: 0,
        end: Math.max(2, duration),
        color: 'rgba(63, 23, 39, 0.35)',
        drag: true,
        resize: true,
        content: 'RESIZE ME!'
      });
    };
    waveEl.addEventListener('decode', onDecode);
    return () => waveEl.removeEventListener('decode', onDecode);
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Barebaros lyd</h1>
      {!audioUrl && (
        <button onClick={handleRecordToggle} style={styles.recordButton(isRecording)}>
          {isRecording ? 'Stopp opptak' : 'Start opptak'}
        </button>
      )}
      <div style={styles.waveformWrapper}>
        {/* WaveSurfer Web Component.  The ref allows us to update its src and
            register event listeners.  The responsive attribute ensures the
            waveform resizes with the container. */}
        <wave-surfer ref={waveRef} responsive style={{ display: audioUrl ? 'block' : 'none', width: '100%', height: '160px' }} />
        {audioUrl && (
          <>
            <div style={styles.hint}>Dra/endre det grønne området, <b>trykk på det for å spille av</b></div>
            <button onClick={handleReset} style={styles.resetButton}>Ta opp nytt</button>
            <div style={styles.tips}>Tips: Trykk på det grønne feltet for å spille valgt område</div>
          </>
        )}
      </div>
    </div>
  );
}

// Inline styles for the component.  Feel free to adjust colors and sizes
// to match your overall design.  The buttons use gradient backgrounds and
// shadows similar to the original design provided by the user.
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Segoe UI, sans-serif',
    padding: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 700,
    color: '#2d3a4b',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 1.1,
  },
  recordButton: (isRecording) => ({
    background: isRecording
      ? 'linear-gradient(90deg, #ff5858 0%, #f09819 100%)'
      : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 50,
    padding: '20px 40px',
    fontSize: 22,
    fontWeight: 600,
    boxShadow: isRecording
      ? '0 8px 32px rgba(255,88,88,0.11)'
      : '0 8px 32px rgba(102,126,234,0.2)',
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginBottom: 24,
    minWidth: 240,
  }),
  resetButton: {
    background: 'linear-gradient(90deg, #ff5858 0%, #f09819 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 40,
    padding: '16px 38px',
    fontSize: 20,
    fontWeight: 600,
    boxShadow: '0 4px 16px rgba(255,88,88,0.11)',
    cursor: 'pointer',
    minWidth: 180,
    marginTop: 28,
  },
  waveformWrapper: {
    margin: '32px auto 0',
    maxWidth: 700,
    width: '95%',
    minHeight: 180,
    position: 'relative',
  },
  hint: {
    textAlign: 'center',
    color: '#888',
    marginTop: 8,
  },
  tips: {
    fontSize: 13,
    color: '#999',
    marginTop: 14,
    textAlign: 'center',
  },
};