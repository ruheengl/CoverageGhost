const express = require('express');
const router = express.Router();
const coveragePrompt = require('../prompts/coveragePrompt');
const policy = require('../data/samplePolicy.json');

router.post('/', async (req, res) => {
  try {
    const { damageJson } = req.body;
    if (!damageJson) return res.status(400).json({ error: 'No damage data provided' });

    const userMessage = `DAMAGE ASSESSMENT:
${JSON.stringify(damageJson, null, 2)}

POLICY DOCUMENT:
${JSON.stringify(policy, null, 2)}

Return coverage decisions for each damaged area.`;

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
        system: coveragePrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json(json);
  } catch (err) {
    console.error('checkCoverage error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
