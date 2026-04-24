const express = require('express');
const router = express.Router();
const coveragePrompt = require('../prompts/coveragePrompt');
const policy = require('../data/samplePolicy.json');
const {
  createChatCompletion,
  extractTextResponse,
  parseJsonResponse,
} = require('../lib/tamusChat');

router.post('/', async (req, res) => {
  try {
    const { damageJson } = req.body;
    if (!damageJson) return res.status(400).json({ error: 'No damage data provided' });

    const userMessage = `DAMAGE ASSESSMENT:
${JSON.stringify(damageJson, null, 2)}

POLICY DOCUMENT:
${JSON.stringify(policy, null, 2)}

Return coverage decisions for each damaged area.`;

    const data = await createChatCompletion({
      messages: [
        { role: 'system', content: coveragePrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const text = extractTextResponse(data);
    const json = parseJsonResponse(text);
    res.json(json);
  } catch (err) {
    console.error('checkCoverage error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
