const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, '../debug-images');

router.post('/', (req, res) => {
  const { scanId, notes } = req.body;
  if (!scanId || !Array.isArray(notes)) return res.status(400).json({ error: 'scanId and notes required' });
  const dir = path.join(DEBUG_DIR, `scan-${scanId}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'notes.json'), JSON.stringify(notes, null, 2));
  console.log(`[saveNotes] saved ${notes.length} notes for scan ${scanId}`);
  res.json({ ok: true });
});

router.get('/:scanId', (req, res) => {
  const notesPath = path.join(DEBUG_DIR, `scan-${req.params.scanId}`, 'notes.json');
  if (!fs.existsSync(notesPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(notesPath, 'utf8')));
});

module.exports = router;
