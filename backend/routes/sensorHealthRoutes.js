import { Router } from 'express';
import SensorHealthEvent from '../models/SensorHealthEvent.js';
import { getConnectionStatus } from '../config/db.js';

const router = Router();

router.get('/', async (_req, res) => {
  if (!getConnectionStatus().connected) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const events = await SensorHealthEvent.find().sort({ timestamp: -1 }).limit(100).lean();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (!getConnectionStatus().connected) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const data = Array.isArray(req.body) ? req.body : [req.body];
    const docs = await SensorHealthEvent.insertMany(data);
    res.status(201).json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
