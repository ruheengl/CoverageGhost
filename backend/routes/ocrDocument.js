const express = require('express');
const router = express.Router();
const ocrPrompt = require('../prompts/ocrPrompt');
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
