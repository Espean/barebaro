export async function decodeToBuffer(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  return await ctx.decodeAudioData(arrayBuffer);
}

export function trimBuffer(buffer, start, end) {
  const sampleRate = buffer.sampleRate;
  const startFrame = Math.floor(start * sampleRate);
  const endFrame = Math.floor(end * sampleRate);
  const frameCount = Math.max(0, endFrame - startFrame);
  const out = new AudioContext().createBuffer(buffer.numberOfChannels, frameCount, sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const slice = buffer.getChannelData(ch).subarray(startFrame, endFrame);
    out.copyToChannel(slice, ch, 0);
  }
  return out;
}

export function encodeWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = buffer.length * numCh * bytesPerSample;
  const totalSize = 44 + dataSize;
  const ab = new ArrayBuffer(totalSize);
  const dv = new DataView(ab);
  let off = 0;
  function wStr(s){ for(let i=0;i<s.length;i++) dv.setUint8(off++, s.charCodeAt(i)); }
  function w32(v){ dv.setUint32(off, v, true); off+=4; }
  function w16(v){ dv.setUint16(off, v, true); off+=2; }
  wStr('RIFF'); w32(totalSize-8); wStr('WAVE');
  wStr('fmt '); w32(16); w16(1); w16(numCh); w32(sampleRate);
  w32(sampleRate * numCh * bytesPerSample); w16(numCh * bytesPerSample); w16(8*bytesPerSample);
  wStr('data'); w32(dataSize);
  const interleaved = new Int16Array(buffer.length * numCh);
  for (let ch=0; ch<numCh; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i=0;i<buffer.length;i++) {
      interleaved[i*numCh+ch] = Math.max(-1, Math.min(1, data[i])) * 0x7FFF;
    }
  }
  new Uint8Array(ab,44).set(new Uint8Array(interleaved.buffer));
  return new Blob([ab], { type:'audio/wav' });
}

export async function trimBlob(blob, start, end) {
  const buf = await decodeToBuffer(blob);
  const trimmed = trimBuffer(buf, start, end);
  return encodeWav(trimmed);
}
