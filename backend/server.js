import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, getConnectionStatus } from './config/db.js';
import trafficRoutes from './routes/trafficRoutes.js';
import signalRoutes from './routes/signalRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import pedestrianRoutes from './routes/pedestrianRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';
import sensorHealthRoutes from './routes/sensorHealthRoutes.js';
import videoRoutes from './routes/videoRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '.env'),
];

const resolvedEnvPath = envCandidates.find(candidate => fs.existsSync(candidate));
if (resolvedEnvPath) {
  dotenv.config({ path: resolvedEnvPath });
} else {
  dotenv.config();
}

if (process.env.MONGODB_URI) {
  console.log('[DB] MongoDB URI detected');
} else {
  console.warn('[DB] MongoDB URI not set — running without database.');
}

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/api/health', async (_req, res) => {
  const db = getConnectionStatus();
  let pythonServiceStatus = 'disconnected';

  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const pythonData = await response.json();
    pythonServiceStatus = response.ok && pythonData?.status === 'ok' ? 'connected' : 'disconnected';
  } catch (err) {
    pythonServiceStatus = 'disconnected';
  }

  res.json({
    server_status: 'ok',
    database_status: db.connected ? 'connected' : 'disconnected',
    python_service_status: pythonServiceStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: db.connected ? 'connected' : 'disconnected',
    databaseReadyState: db.readyState,
    pythonService: pythonServiceStatus,
  });
});

// API routes
app.use('/api/traffic', trafficRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/pedestrian', pedestrianRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/sensor-health', sensorHealthRoutes);
app.use('/api/video', videoRoutes);

// Start server even if MongoDB is unavailable, then retry safely in the background.
async function start() {
  app.listen(PORT, () => {
    console.log(`[Server] FlowSync backend running on http://localhost:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
  });

  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.warn('[Server] MongoDB not available yet — app remains usable in local simulation mode.');
    setInterval(() => {
      connectDB().catch(() => {});
    }, 15000);
  }
}

start();
