const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ocrPrompt = require('../prompts/ocrPrompt');

const DEBUG_DIR = path.join(__dirname, '../debug-images');
if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR);
const {
  buildImageMessage,
  createChatCompletion,
  extractTextResponse,
  parseJsonResponse,
} = require('../lib/tamusChat');

router.post('/', async (req, res) => {
  try {
    const { imageBase64, mediaType = 'image/jpeg', document_type = 'auto' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

    // DEBUG: save incoming image to disk
    const ext = mediaType.split('/')[1] || 'jpg';
    const filename = `ocr-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(DEBUG_DIR, filename), Buffer.from(imageBase64, 'base64'));
    console.log(`[DEBUG] OCR image saved: debug-images/${filename} (${Math.round(imageBase64.length * 0.75 / 1024)}KB)`);

    const data = await createChatCompletion({
      messages: [
        { role: 'system', content: ocrPrompt },
        buildImageMessage({
          promptText: `Extract fields from this ${document_type} document.`,
          imageBase64,
          mediaType,
        }),
      ],
    });

    const text = extractTextResponse(data);
    const json = parseJsonResponse(text);

    console.log("Json:",json);
    res.json(json);
  } catch (err) {
    console.error('ocrDocument error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
