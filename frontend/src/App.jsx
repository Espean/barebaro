import React, { useState } from 'react';
import RecordPage from './RecordPage';
import BrowsePage from './BrowsePage';

export default function App() {
  const [view, setView] = useState('home');
  return (
    <div style={{ padding: '24px', fontFamily: 'Segoe UI, sans-serif' }}>
      {view === 'home' && (
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ marginBottom: 48 }}>Barebaros lyd</h1>
          <div style={{ display:'flex', gap:32, justifyContent:'center' }}>
            <button className="record-btn" onClick={()=>setView('record')}>Record</button>
            <button className="record-btn" onClick={()=>setView('browse')}>Listen</button>
          </div>
        </div>
      )}
      {view === 'record' && <RecordPage onBack={()=>setView('home')} onBrowse={()=>setView('browse')} />}
      {view === 'browse' && <BrowsePage onBack={()=>setView('home')} />}
    </div>
  );
}
