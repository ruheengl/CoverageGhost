const express = require('express');

const router = express.Router();

router.get('/', async (req, res) => {
  res.status(404).json({
    error: 'No splat asset is available in this local setup yet.'
  });
});

module.exports = router;
