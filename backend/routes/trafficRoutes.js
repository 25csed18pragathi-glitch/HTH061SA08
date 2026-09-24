import { Router } from 'express';
import TrafficRecord from '../models/TrafficRecord.js';
import { getConnectionStatus } from '../config/db.js';

const router = Router();

// GET /api/traffic — latest 100 traffic records
router.get('/', async (req, res) => {
  if (!getConnectionStatus().connected) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  try {
    const records = await TrafficRecord.find().sort({ timestamp: -1 }).limit(100).lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/traffic — save one or more traffic records
router.post('/', async (req, res) => {
  if (!getConnectionStatus().connected) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  try {
    const data = Array.isArray(req.body) ? req.body : [req.body];
    const docs = await TrafficRecord.insertMany(data);
    res.status(201).json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
