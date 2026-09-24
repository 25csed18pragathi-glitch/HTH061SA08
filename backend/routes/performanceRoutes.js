import { Router } from 'express';
import PerformanceRecord from '../models/PerformanceRecord.js';
import { getConnectionStatus } from '../config/db.js';

const router = Router();

router.get('/', async (req, res) => {
  if (!getConnectionStatus().connected) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  try {
    const records = await PerformanceRecord.find().sort({ timestamp: -1 }).limit(100).lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (!getConnectionStatus().connected) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  try {
    const doc = await PerformanceRecord.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
