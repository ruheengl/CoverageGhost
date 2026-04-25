const BASE = '/api';

export async function ocrDocument(imageBase64, document_type = 'auto') {
  const res = await fetch(`${BASE}/ocr-document`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, document_type })
  });
  if (!res.ok) throw new Error('ocrDocument failed');
  return res.json();
}

export async function analyzeDamage(imageBase64) {
  const res = await fetch(`${BASE}/analyze-damage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 })
  });
  if (!res.ok) throw new Error('analyzeDamage failed');
  return res.json();
}

export async function checkCoverage(damageJson) {
  const res = await fetch(`${BASE}/check-coverage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ damageJson })
  });
  if (!res.ok) throw new Error('checkCoverage failed');
  return res.json();
}

export async function uploadFrames(frames) {
  const res = await fetch(`${BASE}/upload-frames`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames })
  });
  if (!res.ok) throw new Error('uploadFrames failed');
  return res.json(); // { jobId }
}

export async function pollJobStatus(jobId) {
  const res = await fetch(`${BASE}/job-status/${jobId}`);
  if (!res.ok) throw new Error('pollJobStatus failed');
  return res.json(); // { status, progress, splatUrl }
}

// Combined: saves frame to backend/debug-images in background, returns AI damage analysis
export async function scanFrame({ frameBase64, angle, bucketIndex, scanId }) {
  const res = await fetch(`${BASE}/scan-frame`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameBase64, angle, bucketIndex, scanId }),
  });
  if (!res.ok) throw new Error('scanFrame failed');
  return res.json();
}

export function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
