import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

const WaveformRecorder = () => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize WaveSurfer on mount
  useEffect(() => {
    if (!waveformRef.current) return;

    // Create WaveSurfer instance with Regions plugin
    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#8e8e8e',           // waveform color
      progressColor: '#555',         // playback progress color
      cursorColor: '#333',           // cursor color
      height: 80,                    // height of waveform in pixels
      plugins: [
        RegionsPlugin.create({})     // initialize the Regions plugin (no special options needed)
      ]
    });

    // When audio is loaded into WaveSurfer, add a region
    wavesurferRef.current.on('ready', () => {
      const duration = wavesurferRef.current.getDuration();
      // Define region end (2s or audio duration if shorter)
      const regionEnd = duration < 2 ? duration : 2;
      // Add a single region from 0 to regionEnd seconds
      wavesurferRef.current.addRegion({
        start: 0,
        end: regionEnd,
        color: 'rgba(0, 123, 255, 0.3)',  // translucent blue region overlay
        drag: true,
        resize: true
      });
    });

    // Update play state for button label
    wavesurferRef.current.on('play', () => setIsPlaying(true));
    wavesurferRef.current.on('pause', () => setIsPlaying(false));
    wavesurferRef.current.on('finish', () => setIsPlaying(false));

    // Cleanup on unmount: destroy wavesurfer instance and stop media tracks if any
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    };
  }, []);

  // Function to start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all audio tracks to release the microphone
        stream.getTracks().forEach(t => t.stop());
        // Create a blob from recorded chunks
        const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
        // Load the recorded audio into WaveSurfer (this will trigger 'ready' event and draw waveform)
        wavesurferRef.current.loadBlob(blob);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone', err);
      alert('Could not access microphone for recording. Please check permissions.');
    }
  };

  // Function to stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Function to toggle playback
  const togglePlayback = () => {
    if (!wavesurferRef.current) return;
    if (wavesurferRef.current.isPlaying()) {
      wavesurferRef.current.pause();
    } else {
      wavesurferRef.current.play();
    }
    // isPlaying state will also be updated by WaveSurfer's events
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Waveform container */}
      <div ref={waveformRef} id="waveform" />

      {/* Controls */}
      <div style={{ marginTop: '10px', textAlign: 'center' }}>
        {/* Record/Stop button */}
        <button onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Recording' : 'Record'}
        </button>
        {/* Play/Pause button (disabled during recording or if no audio loaded) */}
        <button onClick={togglePlayback} disabled={isRecording || !wavesurferRef.current || !wavesurferRef.current.getDuration()}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      {/* Inject CSS for region handle styling */}
      <style>{`
        /* Enlarge region handles for easier mobile interaction */
        .wavesurfer-region .wavesurfer-handle {
          width: 20px !important;
          max-width: 20px !important;
          margin-left: -10px !important;
          background: rgba(0, 123, 255, 0.3) !important;
          cursor: col-resize;
        }
      `}</style>
    </div>
  );
};

export default WaveformRecorder;
