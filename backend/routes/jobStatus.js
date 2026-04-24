const express = require('express');

const router = express.Router();

router.get('/:jobId', async (req, res) => {
  res.json({
    jobId: req.params.jobId,
    status: 'completed',
    progress: 100,
    splatUrl: null
  });
});

module.exports = router;
