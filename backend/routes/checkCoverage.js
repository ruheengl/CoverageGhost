const express = require('express');
const router = express.Router();
const coveragePrompt = require('../prompts/coveragePrompt');
const {
  createChatCompletion,
  extractTextResponse,
  parseJsonResponse,
} = require('../lib/tamusChat');

const STATUS_TO_COLOR = {
  covered: 'green',
  excluded: 'red',
  partial: 'amber',
  requires_review: 'gray',
};

router.post('/', async (req, res) => {
  try {
    const { damageJson } = req.body;
    if (!damageJson) return res.status(400).json({ error: 'No damage data provided' });

    const userMessage = `DAMAGE ASSESSMENT:
${JSON.stringify(damageJson, null, 2)}

Return coverage decisions for each damaged area.`;

    const data = await createChatCompletion({
      messages: [
        { role: 'system', content: coveragePrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const text = extractTextResponse(data);
    const json = parseJsonResponse(text);
    if (Array.isArray(json.coverage_decisions)) {
      json.coverage_decisions = json.coverage_decisions.map(decision => ({
        ...decision,
        coverage_status: decision.color || STATUS_TO_COLOR[decision.coverage_status] || decision.coverage_status || 'gray',
      }));
    }
    res.json(json);
  } catch (err) {
    console.error('checkCoverage error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
