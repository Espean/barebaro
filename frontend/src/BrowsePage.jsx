import React, { useEffect, useState, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

const API_BASE = '/api';

export default function BrowsePage({ onBack }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sounds-list?userId=demo-user`);
      if (!res.ok) throw new Error('List failed');
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const playItem = async (item) => {
    try {
      const blobRes = await fetch(`${item.blobUrl}?${Date.now()}`); // assume blobUrl property or construct
      if (!blobRes.ok) throw new Error('Fetch blob failed');
      const blob = await blobRes.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setPlayingId(null);
      setPlayingId(item.id);
      audio.play();
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm('Slette?')) return;
    try {
      const res = await fetch(`${API_BASE}/sounds-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, userId: 'demo-user' })
      });
      if (!res.ok) throw new Error('Delete failed');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <button onClick={onBack}>Tilbake</button>
      <h2>Dine lyder</h2>
      {loading && <div>Laster...</div>}
      {error && <div style={{ color:'red' }}>{error}</div>}
      <div style={{ display:'grid', gap:12 }}>
        {items.map(i => (
          <div key={i.id} style={{ border:'1px solid #333', padding:12, borderRadius:8 }}>
            <div style={{ fontWeight:600 }}>{i.title || i.fileName || i.id}</div>
            <div style={{ fontSize:12, opacity:0.7 }}>Lengde: {(i.durationSeconds||0).toFixed(2)}s Valgt: {i.startSeconds!=null?`${i.startSeconds.toFixed(2)}-${i.endSeconds.toFixed(2)}s`: 'full'} </div>
            <div style={{ marginTop:8, display:'flex', gap:8 }}>
              <button onClick={()=>playItem(i)} disabled={playingId===i.id}>Play</button>
              <button onClick={()=>deleteItem(i)}>Delete</button>
            </div>
          </div>
        ))}
        {!loading && items.length===0 && <div>Ingen lyder funnet</div>}
      </div>
    </div>
  );
}
