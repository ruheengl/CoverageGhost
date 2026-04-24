const express = require('express');

const router = express.Router();

router.post('/', async (req, res) => {
  const frames = Array.isArray(req.body?.frames) ? req.body.frames : [];

  res.json({
    jobId: `mock-${Date.now()}`,
    receivedFrames: frames.length
  });
});

module.exports = router;
