const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, '../debug-images');

// GET /scan-frames/latest → { scanId, frames: [url, ...] }
router.get('/latest', (req, res) => {
  try {
    if (!fs.existsSync(DEBUG_DIR)) return res.json({ scanId: null, frames: [] });
    const dirs = fs.readdirSync(DEBUG_DIR)
      .filter(d => d.startsWith('scan-') && fs.statSync(path.join(DEBUG_DIR, d)).isDirectory())
      .sort();
    if (!dirs.length) return res.json({ scanId: null, frames: [] });
    const latest = dirs[dirs.length - 1];
    const scanId = latest.replace('scan-', '');
    const files = fs.readdirSync(path.join(DEBUG_DIR, latest))
      .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
      .sort();
    res.json({ scanId, frames: files.map(f => `/api/scan-frames/img/${latest}/${f}`) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /scan-frames/img/:scanDir/:filename → serve image
router.get('/img/:scanDir/:filename', (req, res) => {
  const { scanDir, filename } = req.params;
  const filepath = path.join(DEBUG_DIR, scanDir, filename);
  if (!fs.existsSync(filepath)) return res.status(404).send('Not found');
  res.sendFile(filepath);
});

module.exports = router;
