const express = require('express');
const router = express.Router();
const ocrPrompt = require('../prompts/ocrPrompt');

router.post('/', async (req, res) => {
  try {
    const { imageBase64, mediaType = 'image/jpeg', document_type = 'auto' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: ocrPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: `Extract fields from this ${document_type} document.` }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json(json);
  } catch (err) {
    console.error('ocrDocument error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
