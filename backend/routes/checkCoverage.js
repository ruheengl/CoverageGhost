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

    return res.json({
      coverage_decisions: [
        {
          area_name: 'Front bumper',
          coverage_status: 'green',
          reason: 'Collision coverage applies to front-end impact damage after deductible review.',
          policy_section: 'Collision Coverage',
        },
        {
          area_name: 'Passenger-side door',
          coverage_status: 'amber',
          reason: 'Covered if damage is confirmed as part of the same reported incident.',
          policy_section: 'Loss Assessment',
        },
        {
          area_name: 'Rear quarter panel',
          coverage_status: 'red',
          reason: 'Existing wear or unrelated damage is excluded from this claim.',
          policy_section: 'Exclusions',
        },
      ],
    });

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
