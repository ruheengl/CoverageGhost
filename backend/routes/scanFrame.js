const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const damagePrompt = require('../prompts/damagePrompt');
const { buildImageMessage, createChatCompletion, extractTextResponse, parseJsonResponse } = require('../lib/tamusChat');

const DEBUG_DIR = path.join(__dirname, '../debug-images');

router.post('/', async (req, res) => {
  const { frameBase64, angle, bucketIndex, scanId, mediaType = 'image/jpeg' } = req.body;
  if (!frameBase64) return res.status(400).json({ error: 'frameBase64 required' });

  // Save image in background — does not block the AI response
  setImmediate(() => {
    try {
      const dir = path.join(DEBUG_DIR, `scan-${scanId || 'unknown'}`);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `bucket-${String(bucketIndex).padStart(2, '0')}.jpg`;
      fs.writeFileSync(path.join(dir, filename), Buffer.from(frameBase64, 'base64'));
      console.log(`[scanFrame] saved ${filename} (scan ${scanId})`);
    } catch (e) {
      console.warn('[scanFrame] save error:', e.message);
    }
  });

  // AI analysis — respond as soon as complete
  try {
    const data = await createChatCompletion({
      messages: [
        { role: 'system', content: damagePrompt },
        buildImageMessage({
          promptText: 'Analyze this vehicle damage and return the JSON assessment.',
          imageBase64: frameBase64,
          mediaType,
        }),
      ],
    });
    res.json(parseJsonResponse(extractTextResponse(data)));
  } catch (err) {
    console.error('[scanFrame] AI error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
