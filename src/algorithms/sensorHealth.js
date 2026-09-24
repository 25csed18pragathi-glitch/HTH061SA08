/**
 * Sensor Health Monitoring System
 *
 * Monitors the freshness of traffic-data timestamps for each approach.
 * If an approach does not receive valid data within a configurable timeout,
 * it transitions through: HEALTHY → WARNING → OFFLINE.
 *
 * When OFFLINE:
 *   - Stale traffic data is NOT used for adaptive decisions
 *   - The approach falls back to normal/fixed signal timing
 *   - The fallback still passes through the SafetyValidator
 *   - No fake traffic data is generated
 *
 * On recovery:
 *   - Status transitions to RECOVERED, then HEALTHY
 *   - Adaptive control is restored (safely, through yellow/all-red)
 *
 * All timeouts are configurable from the centralized config.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SENSOR_STATUS = Object.freeze({
  HEALTHY:   'HEALTHY',
  WARNING:   'WARNING',
  OFFLINE:   'OFFLINE',
  RECOVERED: 'RECOVERED',
});

export const SENSOR_DEFAULTS = Object.freeze({
  timeoutMs: 5000,          // 5 seconds — mark as OFFLINE after this
  warningMs: 3000,          // 3 seconds — show WARNING before OFFLINE
  recoveryHoldMs: 2000,     // 2 seconds — hold RECOVERED status before returning to HEALTHY
  fallbackMode: 'FIXED',    // Signal mode used when sensor is offline
});

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

/**
 * Create the initial sensor-health state for all 4 approaches.
 */
export function createInitialSensorState() {
  const now = Date.now();
  const roads = ['north', 'south', 'east', 'west'];
  const state = {};

  for (const road of roads) {
    state[road] = {
      status: SENSOR_STATUS.HEALTHY,
      lastValidDataTime: now,
      lastStatusChange: now,
      signalMode: 'ADAPTIVE',      // 'ADAPTIVE' or 'FIXED'
      fallbackReason: null,
      recoveryTime: null,
    };
  }

  return state;
}

/**
 * Record a valid data event for an approach.
 * This resets the timeout timer and triggers recovery if the sensor was offline.
 */
export function recordSensorData(sensorState, road, now = Date.now()) {
  const current = sensorState[road];
  if (!current) return sensorState;

  let nextStatus = SENSOR_STATUS.HEALTHY;
  let nextSignalMode = 'ADAPTIVE';
  let recoveryTime = null;
  let fallbackReason = null;

  // If the sensor was OFFLINE, transition to RECOVERED (not instantly HEALTHY)
  if (current.status === SENSOR_STATUS.OFFLINE || current.status === SENSOR_STATUS.WARNING) {
    nextStatus = SENSOR_STATUS.RECOVERED;
    nextSignalMode = 'ADAPTIVE';
    recoveryTime = now;
    fallbackReason = null;
  }

  return {
    ...sensorState,
    [road]: {
      ...current,
      status: nextStatus,
      lastValidDataTime: now,
      lastStatusChange: now,
      signalMode: nextSignalMode,
      fallbackReason,
      recoveryTime,
    },
  };
}

/**
 * Evaluate sensor health for all approaches based on elapsed time.
 * Should be called each simulation tick.
 *
 * @param {object} sensorState - Current sensor state
 * @param {number} now - Current timestamp
 * @param {object} sensorConfig - Timeout configuration
 * @returns {{ state: object, events: Array }} Updated state + any events generated
 */
export function evaluateSensorHealth(sensorState, now = Date.now(), sensorConfig = SENSOR_DEFAULTS) {
  const roads = ['north', 'south', 'east', 'west'];
  const nextState = { ...sensorState };
  const events = [];

  for (const road of roads) {
    const current = nextState[road];
    if (!current) continue;

    const elapsed = now - current.lastValidDataTime;

    // RECOVERED → HEALTHY after recovery hold period
    if (current.status === SENSOR_STATUS.RECOVERED) {
      if (now - current.lastStatusChange >= sensorConfig.recoveryHoldMs) {
        nextState[road] = {
          ...current,
          status: SENSOR_STATUS.HEALTHY,
          signalMode: 'ADAPTIVE',
          fallbackReason: null,
          recoveryTime: null,
          lastStatusChange: now,
        };
        events.push({
          time: now,
          road,
          type: 'SENSOR_HEALTHY',
          message: `${road} sensor recovered — adaptive control restored.`,
        });
      }
      continue;
    }

    // Check for timeout
    if (elapsed >= sensorConfig.timeoutMs && current.status !== SENSOR_STATUS.OFFLINE) {
      // Transition to OFFLINE
      nextState[road] = {
        ...current,
        status: SENSOR_STATUS.OFFLINE,
        signalMode: sensorConfig.fallbackMode,
        fallbackReason: `No valid sensor data received within ${sensorConfig.timeoutMs / 1000}s timeout.`,
        lastStatusChange: now,
      };
      events.push({
        time: now,
        road,
        type: 'SENSOR_OFFLINE',
        message: `${road} sensor OFFLINE — switched to ${sensorConfig.fallbackMode} fallback.`,
      });
    } else if (elapsed >= sensorConfig.warningMs && current.status === SENSOR_STATUS.HEALTHY) {
      // Transition to WARNING
      nextState[road] = {
        ...current,
        status: SENSOR_STATUS.WARNING,
        lastStatusChange: now,
      };
      events.push({
        time: now,
        road,
        type: 'SENSOR_WARNING',
        message: `${road} sensor data timeout warning — no data for ${(elapsed / 1000).toFixed(1)}s.`,
      });
    }
  }

  return { state: nextState, events };
}

/**
 * Check if a specific approach sensor is healthy (safe for adaptive control).
 */
export function isSensorHealthy(sensorState, road) {
  const status = sensorState?.[road]?.status;
  return status === SENSOR_STATUS.HEALTHY || status === SENSOR_STATUS.RECOVERED;
}

/**
 * Check if the approach is in fallback mode.
 */
export function isInFallbackMode(sensorState, road) {
  return sensorState?.[road]?.signalMode === 'FIXED';
}

/**
 * Get a summary of all sensor statuses for UI display.
 */
export function getSensorSummary(sensorState) {
  const roads = ['north', 'south', 'east', 'west'];
  return roads.map(road => ({
    road,
    ...sensorState[road],
    timeSinceData: Date.now() - (sensorState[road]?.lastValidDataTime || 0),
  }));
}

/**
 * Count sensors by status.
 */
export function getSensorCounts(sensorState) {
  const counts = { HEALTHY: 0, WARNING: 0, OFFLINE: 0, RECOVERED: 0 };
  for (const road of ['north', 'south', 'east', 'west']) {
    const status = sensorState?.[road]?.status || SENSOR_STATUS.HEALTHY;
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}
