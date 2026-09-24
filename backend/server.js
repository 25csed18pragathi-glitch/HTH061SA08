import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB, getConnectionStatus } from './config/db.js';
import trafficRoutes from './routes/trafficRoutes.js';
import signalRoutes from './routes/signalRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import pedestrianRoutes from './routes/pedestrianRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';
import videoRoutes from './routes/videoRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/api/health', (req, res) => {
  const db = getConnectionStatus();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: db.connected ? 'connected' : 'disconnected',
    databaseReadyState: db.readyState,
  });
});

// API routes
app.use('/api/traffic', trafficRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/pedestrian', pedestrianRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/video', videoRoutes);

// Start server
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] FlowSync backend running on http://localhost:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
  });
}

start();
