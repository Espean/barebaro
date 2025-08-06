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

  // Inject style for visible handles (optional, mostly for desktop/mouse users)
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
      /* Optionally widen handles for visible feedback on desktop */
      #waveform ::part(region-handle) {
        width: 16px !important;
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

    // Setup Regions plugin
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

    // Add a region when ready
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

    // Add mobile-friendly touch overlays to region
    const addTouchHandles = region => {
      // Clean up old overlays if re-adding
      Array.from(region.element.querySelectorAll(".region-touch-overlay")).forEach(el => el.remove());

      ['start', 'end'].forEach(side => {
        const overlay = document.createElement('div');
        overlay.className = "region-touch-overlay";
        Object.assign(overlay.style, {
          position: "absolute",
          top: "0",
          width: "40px", // Wide enough for thumbs!
          height: "100%",
          [side === 'start' ? 'left' : 'right']: "-20px", // Centered on edge
          zIndex: "20",
          background: "transparent",
          touchAction: "none",
          // For debug: background: "rgba(255,0,0,0.2)",
        });
        overlay.addEventListener("pointerdown", evt => {
          evt.stopPropagation();
          // Forward the event to the Wavesurfer handle inside shadow DOM
          const handlePart = region.element.shadowRoot
            ? region.element.shadowRoot.querySelector(`[part="region-handle-${side}"]`)
            : region.element.querySelector(`[part="region-handle-${side}"]`);
          if (handlePart) {
            // Emulate pointer event on the actual handle for true mobile resize
            const event = new PointerEvent("pointerdown", evt);
            handlePart.dispatchEvent(event);
          }
        });
        region.element.appendChild(overlay);
      });
    };

    // Add overlays to every new region
    regions.on("region-created", addTouchHandles);

    // Also add overlays to existing regions (e.g. after undo/redo)
    Object.values(regions.list || {}).forEach(addTouchHandles);

    // Only allow one region at a time
    regions.on("region-created", (region) => {
      Object.values(regions.list).forEach((r) => {
        if (r.id !== region.id) regions.removeRegion(r.id);
      });
    });

    ws.on("error", console.error);

    return () => ws.destroy();
  }, [audioUrl]);

  // Recording logic unchanged
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
        {/* The container needs id for selector */}
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
