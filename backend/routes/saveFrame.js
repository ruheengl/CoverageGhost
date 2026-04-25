const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const FRAMES_DIR = path.join(__dirname, '../scan-frames');

router.post('/', (req, res) => {
  try {
    const { frameBase64, angle, bucketIndex, scanId } = req.body;
    if (!frameBase64 || scanId === undefined) {
      return res.status(400).json({ error: 'frameBase64 and scanId required' });
    }

    const scanDir = path.join(FRAMES_DIR, String(scanId));
    if (!fs.existsSync(scanDir)) fs.mkdirSync(scanDir, { recursive: true });

    const filename = `frame-${String(bucketIndex).padStart(2, '0')}-${Math.round(angle)}deg.jpg`;
    const filepath = path.join(scanDir, filename);
    const buffer = Buffer.from(frameBase64, 'base64');
    fs.writeFileSync(filepath, buffer);

    console.log(`[saveFrame] scan=${scanId} ${filename} ${(buffer.length / 1024).toFixed(1)}KB`);
    res.json({ saved: true, filename });
  } catch (err) {
    console.error('[saveFrame]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
