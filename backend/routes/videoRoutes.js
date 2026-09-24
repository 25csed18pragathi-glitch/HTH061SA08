import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConnectionStatus } from '../config/db.js';
import VideoAnalysis from '../models/VideoAnalysis.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Temp upload directory
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported format: ${ext}`));
  },
});

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * GET /api/video/health — check Python detection service status
 */
router.get('/health', async (_req, res) => {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    res.json({ pythonService: 'connected', ...data });
  } catch {
    res.json({ pythonService: 'disconnected', modelLoaded: false, error: 'Python detection service unreachable' });
  }
});

/**
 * POST /api/video/analyze — proxy video to Python for YOLO detection
 * 
 * Accepts multipart form data with:
 *   video — the video file
 *   road  — north | south | east | west
 *   confidence_threshold  — optional
 *   frame_sample_interval — optional
 */
router.post('/analyze', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No video file uploaded.' });
  }

  const filePath = req.file.path;
  const road = req.body.road || 'north';
  const confThreshold = req.body.confidence_threshold || '';
  const sampleInterval = req.body.frame_sample_interval || '';

  try {
    // Build FormData to forward to Python
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: req.file.mimetype || 'video/mp4' });
    formData.append('video', blob, req.file.originalname);
    formData.append('road', road);
    if (confThreshold) formData.append('confidence_threshold', confThreshold);
    if (sampleInterval) formData.append('frame_sample_interval', sampleInterval);

    // Forward to Python service
    const pythonRes = await fetch(`${PYTHON_SERVICE_URL}/detect`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    const result = await pythonRes.json();

    // Store result in MongoDB (fire-and-forget)
    if (result.success && getConnectionStatus().connected) {
      VideoAnalysis.create({
        road: result.road,
        source: result.source,
        detectionModel: result.detectionModel,
        modelFile: result.modelFile,
        counts: result.counts,
        totalVehicles: result.totalVehicles,
        density: result.density,
        trafficStatus: result.trafficStatus,
        queueLength: result.queueLength,
        confidence: result.confidence,
        framesProcessed: result.framesProcessed,
        processingTime: result.processingTime,
      }).catch(err => console.warn('[VideoRoutes] MongoDB save failed:', err.message));
    }

    res.status(pythonRes.status).json(result);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return res.status(504).json({ success: false, error: 'Python detection service timed out.' });
    }
    console.error('[VideoRoutes] Proxy error:', err.message);
    res.status(502).json({
      success: false,
      error: `Python detection service error: ${err.message}`,
    });
  } finally {
    // Cleanup uploaded file
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
});

/**
 * GET /api/video/history — recent video analysis results from MongoDB
 */
router.get('/history', async (_req, res) => {
  if (!getConnectionStatus().connected) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  try {
    const records = await VideoAnalysis.find().sort({ createdAt: -1 }).limit(50);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
