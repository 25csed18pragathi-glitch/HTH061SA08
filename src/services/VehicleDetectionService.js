/**
 * VehicleDetectionService
 * 
 * Modular service designed for YOLO/OpenCV integration via the Python backend.
 * 
 * Architecture:
 *   React → Node/Express (POST /api/video/analyze) → Python/Flask → YOLO → OpenCV → NumPy
 * 
 * When the Python service is running:
 *   - isModelAvailable() returns true
 *   - analyzeVideo() sends the file through the pipeline
 *   - Results are REAL YOLO detections
 * 
 * When the Python service is NOT running:
 *   - isModelAvailable() returns false
 *   - User gets a clear "model not connected" message
 *   - Manual estimation fallback is available
 * 
 * IMPORTANT — "auto" (auto-rickshaw) is NOT a standard COCO class.
 * YOLOv8 trained on COCO cannot directly detect auto-rickshaws.
 * The "auto" count will always be 0 from real detection.
 */

import { fetchVideoHealth, postVideoAnalyze } from '../utils/api';

/** Detection source types */
export const DETECTION_SOURCE = Object.freeze({
  MODEL: 'MODEL',
  MANUAL_ESTIMATION: 'MANUAL_ESTIMATION',
});

/** Service status */
export const SERVICE_STATUS = Object.freeze({
  IDLE: 'IDLE',
  UPLOADING: 'UPLOADING',
  ANALYZING: 'ANALYZING',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
});

const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

// Cached model status (refreshed on demand)
let _modelStatus = { available: false, lastCheck: 0, detail: null };
const CACHE_TTL = 10_000; // 10 seconds

/**
 * Check if a real detection model (YOLO/OpenCV) is connected via the Python service.
 * Queries GET /api/video/health through the Node backend.
 */
export async function checkModelAvailability() {
  const now = Date.now();
  if (now - _modelStatus.lastCheck < CACHE_TTL) return _modelStatus.available;

  try {
    const { ok, data } = await fetchVideoHealth();
    const available = ok && data?.modelLoaded === true && data?.pythonService === 'connected';
    _modelStatus = { available, lastCheck: now, detail: data };
    return available;
  } catch {
    _modelStatus = { available: false, lastCheck: now, detail: null };
    return false;
  }
}

/**
 * Synchronous check using cached status. Call checkModelAvailability() first to refresh.
 */
export function isModelAvailable() {
  return _modelStatus.available;
}

/**
 * Get detailed model status info.
 */
export function getModelDetail() {
  return _modelStatus.detail;
}

/**
 * Validate a video file for upload.
 */
export function validateVideoFile(file) {
  if (!file) return { valid: false, error: 'No file selected' };
  if (!ACCEPTED_TYPES.includes(file.type)) return { valid: false, error: `Unsupported format: ${file.type}. Use MP4, WebM, or MOV.` };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 500 MB.` };
  return { valid: true, error: null };
}

/**
 * Create a browser-local preview URL for the uploaded video.
 */
export function createVideoPreview(file) {
  return URL.createObjectURL(file);
}

/**
 * Release a preview URL to free memory.
 */
export function revokeVideoPreview(url) {
  if (url) URL.revokeObjectURL(url);
}

/**
 * Send video to the YOLO detection pipeline via Node → Python.
 * Returns real detection results, never fabricated.
 */
export async function detectVehiclesFromVideo(file, road, options = {}) {
  const { ok, data, error } = await postVideoAnalyze(file, road, options);
  if (!ok || !data?.success) {
    return {
      status: SERVICE_STATUS.ERROR,
      error: data?.error || error || 'Detection failed',
      result: null,
    };
  }
  return {
    status: SERVICE_STATUS.COMPLETE,
    error: null,
    result: {
      source: DETECTION_SOURCE.MODEL,
      totalVehicles: data.totalVehicles,
      vehicles: data.counts,
      density: data.density,
      trafficStatus: data.trafficStatus,
      queueLength: data.queueLength,
      confidence: data.confidence,
      framesProcessed: data.framesProcessed,
      processingTime: data.processingTime,
      detectionModel: data.detectionModel,
      modelFile: data.modelFile,
      frameSampleInterval: data.frameSampleInterval,
      classMapping: data.classMapping,
    },
  };
}

/**
 * Fallback manual estimation mode.
 * The user provides vehicle counts manually after watching the video.
 * This does NOT perform any AI detection — clearly labeled.
 */
export function createManualEstimation(vehicleCounts = {}) {
  const counts = {
    cycle: Math.max(0, Math.floor(Number(vehicleCounts.cycle) || 0)),
    bike: Math.max(0, Math.floor(Number(vehicleCounts.bike) || 0)),
    auto: Math.max(0, Math.floor(Number(vehicleCounts.auto) || 0)),
    car: Math.max(0, Math.floor(Number(vehicleCounts.car) || 0)),
    heavy: Math.max(0, Math.floor(Number(vehicleCounts.heavy) || 0)),
  };
  const totalVehicles = Object.values(counts).reduce((sum, v) => sum + v, 0);
  return {
    source: DETECTION_SOURCE.MANUAL_ESTIMATION,
    totalVehicles,
    vehicles: counts,
    confidence: 0,
    framesProcessed: 0,
  };
}

/**
 * Create an empty analysis result structure.
 */
export function createEmptyAnalysisResult() {
  return {
    source: null,
    totalVehicles: 0,
    vehicles: { cycle: 0, bike: 0, auto: 0, car: 0, heavy: 0 },
    density: 0,
    queueLength: 0,
    flowRate: 0,
    confidence: 0,
    framesProcessed: 0,
  };
}

/**
 * Run the full analysis pipeline.
 * Tries the real YOLO model first, falls back to MODEL_UNAVAILABLE status.
 */
export async function analyzeVideo(file, road = 'north', options = {}) {
  const validation = validateVideoFile(file);
  if (!validation.valid) {
    return { status: SERVICE_STATUS.ERROR, error: validation.error, result: null };
  }

  // Check model availability
  const available = await checkModelAvailability();

  if (available) {
    const detection = await detectVehiclesFromVideo(file, road, options);
    return detection;
  }

  return {
    status: SERVICE_STATUS.MODEL_UNAVAILABLE,
    error: null,
    result: null,
    message: 'Video uploaded successfully. Vehicle detection model is not connected. Use manual estimation mode.',
  };
}
