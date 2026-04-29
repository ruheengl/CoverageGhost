const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const SPLAT_PATH = path.join(__dirname, '..', 'assets', 'final_car.ply');

router.get('/', (req, res) => {

  console.log("Path:",SPLAT_PATH);
  if (!fs.existsSync(SPLAT_PATH)) {
    return res.status(404).json({ error: 'Splat asset not found.' });
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'inline; filename="final_car.ply"');
  fs.createReadStream(SPLAT_PATH).pipe(res);
});

module.exports = router;
