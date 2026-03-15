// Express entry point — mounts all routes and serves /public static files
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const agentRoutes = require('./routes/agent');
const worldRoutes = require('./routes/world');
const voiceRoutes = require('./routes/voice');
const { primeDemoCache, responseCache } = require('./services/claude');
const { checkTTS } = require('./services/tts');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, 'public')));

// API overview (moved to /api/info so index.html is served at /)
app.get('/api/info', (req, res) => {
  res.json({
    status: 'Scout server online',
    endpoints: [
      'POST /api/scout-mission',
      'POST /api/generate-world',
      'POST /api/speak',
      'GET /api/health'
    ]
  });
});

// API routes
app.use('/api', agentRoutes);
app.use('/api', worldRoutes);
app.use('/api', voiceRoutes);

// Cache status
app.get('/api/cache-status', (req, res) => {
  res.json({
    cached: responseCache.size,
    worlds: ['space_station', 'jungle_temple', 'cyberpunk_rooftop'],
  });
});

// Health check
app.get('/api/health', (req, res) => {
  const apis = {
    claude: !!process.env.CLAUDE_API_KEY,
    marble: !!process.env.WORLDLABS_API_KEY,
    openai_tts: !!process.env.OPENAI_API_KEY,
  };
  res.json({ status: 'ok', apis });
});

// Startup warnings for missing keys
const keys = ['CLAUDE_API_KEY', 'WORLDLABS_API_KEY', 'OPENAI_API_KEY'];
keys.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`⚠️  WARNING: ${key} is not set in .env — related features will be degraded`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛰️  Scout server running on http://0.0.0.0:${PORT}`);
  console.log(`   LAN access: http://<your-ip>:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);

  // Check TTS on startup
  checkTTS();

  // Prime demo cache in background — don't block startup
  primeDemoCache().then(r => console.log(`🎯 Cache primed: ${r.primed} responses ready`));
});
