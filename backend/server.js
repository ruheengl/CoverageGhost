const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/upload-frames',  require('./routes/uploadFrames'));
app.use('/job-status',     require('./routes/jobStatus'));
app.use('/splat',          require('./routes/serveSplat'));
app.use('/analyze-damage', require('./routes/analyzeDamage'));
app.use('/check-coverage', require('./routes/checkCoverage'));
app.use('/ocr-document',   require('./routes/ocrDocument'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend on port ${PORT}`));
