const API_BASE = 'http://localhost:5000/api';

/**
 * Reusable fetch wrapper for the FlowSync backend.
 * Returns { ok, data, error } — never throws, so callers can degrade gracefully.
 */
async function request(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch {
    // Network error or backend not running — degrade silently
    return { ok: false, status: 0, data: null, error: 'Backend unreachable' };
  }
}

/** GET /api/health */
export const fetchHealth = () => request('/health');

/** GET /api/traffic */
export const fetchTrafficRecords = () => request('/traffic');

/** POST /api/traffic — accepts a single record or an array */
export const postTrafficRecords = (records) =>
  request('/traffic', { method: 'POST', body: JSON.stringify(records) });

/** GET /api/signals */
export const fetchSignalEvents = () => request('/signals');

/** POST /api/signals */
export const postSignalEvent = (event) =>
  request('/signals', { method: 'POST', body: JSON.stringify(event) });

/** GET /api/emergency */
export const fetchEmergencyEvents = () => request('/emergency');

/** POST /api/emergency */
export const postEmergencyEvent = (event) =>
  request('/emergency', { method: 'POST', body: JSON.stringify(event) });

/** GET /api/pedestrian */
export const fetchPedestrianEvents = () => request('/pedestrian');

/** POST /api/pedestrian */
export const postPedestrianEvent = (event) =>
  request('/pedestrian', { method: 'POST', body: JSON.stringify(event) });

/** GET /api/performance */
export const fetchPerformanceRecords = () => request('/performance');

/** POST /api/performance */
export const postPerformanceRecord = (record) =>
  request('/performance', { method: 'POST', body: JSON.stringify(record) });

/** GET /api/video/health — check Python detection service */
export const fetchVideoHealth = () => request('/video/health');

/**
 * POST /api/video/analyze — upload video for YOLO detection.
 * Uses FormData (no Content-Type header — browser sets multipart boundary).
 */
export async function postVideoAnalyze(file, road, options = {}) {
  try {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('road', road);
    if (options.confidenceThreshold) formData.append('confidence_threshold', String(options.confidenceThreshold));
    if (options.frameSampleInterval) formData.append('frame_sample_interval', String(options.frameSampleInterval));

    const res = await fetch(`${API_BASE}/video/analyze`, {
      method: 'POST',
      body: formData,
      // No Content-Type header — let browser set multipart boundary
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Backend unreachable' };
  }
}

/** GET /api/video/history */
export const fetchVideoHistory = () => request('/video/history');
