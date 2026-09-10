// src/index.js
require('dotenv').config();
const express      = require('express');
const listingsRoute      = require('./routes/listings');
const studentsRoute      = require('./routes/students');
const applicationsRoute  = require('./routes/applications');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health-check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'skillbridge-engine' }));

// Routes
app.use('/api/listings',     listingsRoute);
app.use('/api/students',     studentsRoute);
app.use('/api/applications', applicationsRoute);

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => {
  console.log(`SkillBridge matching engine listening on port ${PORT}`);
});

module.exports = app;
