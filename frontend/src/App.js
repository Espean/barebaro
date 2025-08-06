import React, { useRef, useEffect, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

export default function App() {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionsRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Optional: Style for region content, etc
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .ws-region-content {
        color: #212121 !important;
        font-weight: 900;
        font-size: 32px;
        pointer-events: none;
        padding: 5px 24px;
        border-radius: 12px;
        position: absolute !important;
        left: 50%;
        top: -52px;
        background: rgba(255,255,255,0.95);
        transform: translateX(-50%);
        z-index: 99;
        border: 2px solid #4aef95;
        box-shadow: 0 2px 16px #b8f2e6a8;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const regions = RegionsPlugin.create({
      dragSelection: { color: "rgba(46,204,113,0.12)" },
    });
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#43cea2",
      progressColor: "#185a9d",
      url: audioUrl,
      height: 160,
      plugins: [regions],
      responsive: true,
    });
    wavesurferRef.current = ws;

    ws.on("ready", () => {
      const dur = ws.getDuration();
      regions.addRegion({
        start: 0,
        end: Math.max(2, dur),
        color: "rgba(63, 23, 39, 0.35)",
        drag: true,
        resize: true,
        content: "RESIZE ME!",
      });
    });

    // ---- Key fix for mobile: make the real handles much bigger
    regions.on("region-created", (region) => {
      // Make handles wider for touch
      const left = region.element.querySelector('[part="region-handle-left"]');
      const right = region.element.querySelector('[part="region-handle-right"]');
      if (left) {
        left.style.width = "36px";         // Much wider for finger
        left.style.marginLeft = "-18px";   // Center the grab area on the edge
        left.style.zIndex = "10";
        left.style.cursor = "ew-resize";
        left.style.background = "rgba(0,0,0,0.01)"; // almost invisible
        left.style.touchAction = "none";
      }
      if (right) {
        right.style.width = "36px";
        right.style.marginRight = "-18px";
        right.style.zIndex = "10";
        right.style.cursor = "ew-resize";
        right.style.background = "rgba(0,0,0,0.01)";
        right.style.touchAction = "none";
      }

      // Only keep one region at a time (if you want)
      Object.values(regions.list).forEach((r) => {
        if (r.id !== region.id) regions.removeRegion(r.id);
      });
    });

    ws.on("error", console.error);

    return () => ws.destroy();
  }, [audioUrl]);

  // Recording logic
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
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
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

  const handleReset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setIsRecording(false);
    if (wavesurferRef.current) wavesurferRef.current.destroy();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Segoe UI, sans-serif",
      padding: 16,
    }}>
      <h1 style={{
        fontSize: 36,
        fontWeight: 700,
        color: "#2d3a4b",
        marginBottom: 32,
        textAlign: "center",
        lineHeight: 1.1,
      }}>
        Barebaros lyd
      </h1>

      {!audioUrl && (
        <button
          onClick={handleRecordToggle}
          style={{
            background: isRecording
              ? "linear-gradient(90deg, #ff5858 0%, #f09819 100%)"
              : "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 50,
            padding: "20px 40px",
            fontSize: 22,
            fontWeight: 600,
            boxShadow: isRecording
              ? "0 8px 32px rgba(255,88,88,0.11)"
              : "0 8px 32px rgba(102,126,234,0.2)",
            cursor: "pointer",
            transition: "background 0.2s",
            marginBottom: 24,
            minWidth: 240,
          }}
        >
          {isRecording ? "Stopp opptak" : "Start opptak"}
        </button>
      )}

      <div style={{
        margin: "32px auto 0",
        maxWidth: 700,
        width: "95%",
        minHeight: 180,
        display: audioUrl ? "block" : "none",
      }}>
        <div id="waveform" ref={waveformRef} style={{ width: "100%" }} />

        <div style={{ textAlign: "center", color: "#888", marginTop: 8 }}>
          Dra/endre det grønne området, <b>trykk på det for å spille av</b>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "center",
          margin: "28px 0 0",
        }}>
          <button
            onClick={handleReset}
            style={{
              background: "linear-gradient(90deg, #ff5858 0%, #f09819 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 40,
              padding: "16px 38px",
              fontSize: 20,
              fontWeight: 600,
              boxShadow: "0 4px 16px rgba(255,88,88,0.11)",
              cursor: "pointer",
              minWidth: 180,
            }}
          >
            Ta opp nytt
          </button>
        </div>

        <div style={{
          fontSize: 13,
          color: "#999",
          marginTop: 14,
          textAlign: "center",
        }}>
          Tips: Trykk på det grønne feltet for å spille valgt område
        </div>
      </div>
    </div>
  );
}
