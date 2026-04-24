const express = require('express');
const router = express.Router();
const damagePrompt = require('../prompts/damagePrompt');
const {
  buildImageMessage,
  createChatCompletion,
  extractTextResponse,
  parseJsonResponse,
} = require('../lib/tamusChat');

router.post('/', async (req, res) => {
  try {
    const { imageBase64, mediaType = 'image/jpeg' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

    const data = await createChatCompletion({
      messages: [
        { role: 'system', content: damagePrompt },
        buildImageMessage({
          promptText: 'Analyze this damage and return the JSON assessment.',
          imageBase64,
          mediaType,
        }),
      ],
    });

    const text = extractTextResponse(data);
    const json = parseJsonResponse(text);
    res.json(json);
  } catch (err) {
    console.error('analyzeDamage error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
