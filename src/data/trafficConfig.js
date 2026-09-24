export const ROAD_NAMES = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
};

export const VEHICLE_WEIGHTS = Object.freeze({
  cycle: 0.1,
  bike: 0.2,
  auto: 0.3,
  car: 0.4,
  heavy: 1.0,
});

export const VEHICLE_LABELS = Object.freeze({
  cycle: 'Cycle',
  bike: 'Bike',
  auto: 'Auto',
  car: 'Car',
  heavy: 'Heavy Vehicle',
});

export const VEHICLE_TYPES = Object.keys(VEHICLE_WEIGHTS);

export const TRAFFIC_THRESHOLDS = Object.freeze({
  normalDensity: 8,
  highDensity: 20,
  rushDensity: 35,
  normalVehicles: 20,
  highVehicles: 35,
  rushVehicles: 50,
});

export const SIMULATION_SCENARIOS = Object.freeze({
  offpeak: { label: 'OFF-PEAK', arrivalsPerSecond: 0.18 },
  normal: { label: 'NORMAL', arrivalsPerSecond: 0.55 },
  rush: { label: 'RUSH HOUR', arrivalsPerSecond: 1.15 },
  surge: { label: 'SUDDEN SURGE', arrivalsPerSecond: 0.55 },
});

export const SIGNAL_TIMING_DEFAULTS = Object.freeze({
  minGreen: 10,
  maxGreen: 50,
  yellow: 3,
  allRed: 2,
});

export const ADAPTIVE_PRIORITY_WEIGHTS = Object.freeze({
  density: 1,
  queue: 1,
  waiting: 1,
});

export const STARVATION_DEFAULTS = Object.freeze({
  threshold: 45,
  warningRatio: 0.75,
  waitingWeight: 1,
  cycleWeight: 5,
  boostWeight: 2,
});

export const PEDESTRIAN_DEFAULTS = Object.freeze({
  walkDuration: 15,
  highDemandCount: 25,
  maxPendingRequests: 3,
});

export const PEDESTRIAN_PROTECTION_DEFAULTS = Object.freeze({
  debounceMs: 2500,    // Ignore repeated presses within this interval
  cooldownMs: 15000,   // Cooldown after a pedestrian phase is served
});

export const EMERGENCY_DEFAULTS = Object.freeze({
  greenDuration: 15,
  maxQueue: 8,
});

export const EMERGENCY_TYPES = Object.freeze(['Ambulance', 'Fire Engine', 'Police']);

export const SENSOR_HEALTH_DEFAULTS = Object.freeze({
  timeoutMs: 5000,          // Mark sensor OFFLINE after this duration
  warningMs: 3000,          // Show WARNING before OFFLINE
  recoveryHoldMs: 2000,     // Hold RECOVERED status before returning to HEALTHY
  fallbackMode: 'FIXED',    // Signal mode used when sensor is offline
});

export function getTrafficConfig() {
  const defaults = { ...VEHICLE_WEIGHTS, ...TRAFFIC_THRESHOLDS };
  try {
    const stored = JSON.parse(localStorage.getItem('traffic-settings') || '{}');
    const rawTiming = Object.keys(SIGNAL_TIMING_DEFAULTS).reduce((timing, key) => ({ ...timing, [key]: Number.isFinite(Number(stored[key])) ? Number(stored[key]) : SIGNAL_TIMING_DEFAULTS[key] }), {});
    return {
      weights: VEHICLE_TYPES.reduce((weights, type) => ({ ...weights, [type]: Number.isFinite(Number(stored[type])) ? Number(stored[type]) : VEHICLE_WEIGHTS[type] }), {}),
      thresholds: {
        normalDensity: Number.isFinite(Number(stored.normalDensity)) ? Number(stored.normalDensity) : defaults.normalDensity,
        highDensity: Number.isFinite(Number(stored.highDensity)) ? Number(stored.highDensity) : defaults.highDensity,
        rushDensity: Number.isFinite(Number(stored.rushDensity)) ? Number(stored.rushDensity) : defaults.rushDensity,
        normalVehicles: Number.isFinite(Number(stored.normalVehicles)) ? Number(stored.normalVehicles) : defaults.normalVehicles,
        highVehicles: Number.isFinite(Number(stored.highVehicles)) ? Number(stored.highVehicles) : defaults.highVehicles,
        rushVehicles: Number.isFinite(Number(stored.rushVehicles)) ? Number(stored.rushVehicles) : defaults.rushVehicles,
      },
      signalTiming: { ...rawTiming, minGreen: Math.min(rawTiming.minGreen, rawTiming.maxGreen), maxGreen: Math.max(rawTiming.minGreen, rawTiming.maxGreen) },
      priorityWeights: Object.keys(ADAPTIVE_PRIORITY_WEIGHTS).reduce((weights, key) => ({ ...weights, [key]: Number.isFinite(Number(stored[`${key}Weight`])) ? Number(stored[`${key}Weight`]) : ADAPTIVE_PRIORITY_WEIGHTS[key] }), {}),
      starvation: Object.keys(STARVATION_DEFAULTS).reduce((values, key) => ({ ...values, [key]: Number.isFinite(Number(stored[`starvation${key[0].toUpperCase()}${key.slice(1)}`])) ? Number(stored[`starvation${key[0].toUpperCase()}${key.slice(1)}`]) : STARVATION_DEFAULTS[key] }), {}),
      pedestrian: {
        walkDuration: Number.isFinite(Number(stored.pedestrianWalkDuration)) ? Number(stored.pedestrianWalkDuration) : PEDESTRIAN_DEFAULTS.walkDuration,
        highDemandCount: Number.isFinite(Number(stored.pedestrianHighDemandCount)) ? Number(stored.pedestrianHighDemandCount) : PEDESTRIAN_DEFAULTS.highDemandCount,
        maxPendingRequests: Number.isFinite(Number(stored.pedestrianMaxPendingRequests)) ? Number(stored.pedestrianMaxPendingRequests) : PEDESTRIAN_DEFAULTS.maxPendingRequests,
      },
      emergency: {
        greenDuration: Number.isFinite(Number(stored.emergencyGreenDuration)) ? Number(stored.emergencyGreenDuration) : EMERGENCY_DEFAULTS.greenDuration,
        maxQueue: Number.isFinite(Number(stored.emergencyMaxQueue)) ? Number(stored.emergencyMaxQueue) : EMERGENCY_DEFAULTS.maxQueue,
      },
      pedestrianProtection: {
        debounceMs: Number.isFinite(Number(stored.pedestrianDebounceMs)) ? Number(stored.pedestrianDebounceMs) : PEDESTRIAN_PROTECTION_DEFAULTS.debounceMs,
        cooldownMs: Number.isFinite(Number(stored.pedestrianCooldownMs)) ? Number(stored.pedestrianCooldownMs) : PEDESTRIAN_PROTECTION_DEFAULTS.cooldownMs,
      },
      sensorHealth: {
        timeoutMs: Number.isFinite(Number(stored.sensorTimeoutMs)) ? Number(stored.sensorTimeoutMs) : SENSOR_HEALTH_DEFAULTS.timeoutMs,
        warningMs: Number.isFinite(Number(stored.sensorWarningMs)) ? Number(stored.sensorWarningMs) : SENSOR_HEALTH_DEFAULTS.warningMs,
        recoveryHoldMs: Number.isFinite(Number(stored.sensorRecoveryHoldMs)) ? Number(stored.sensorRecoveryHoldMs) : SENSOR_HEALTH_DEFAULTS.recoveryHoldMs,
        fallbackMode: stored.sensorFallbackMode || SENSOR_HEALTH_DEFAULTS.fallbackMode,
      },
    };
  } catch {
    return { weights: { ...VEHICLE_WEIGHTS }, thresholds: { ...TRAFFIC_THRESHOLDS }, signalTiming: { ...SIGNAL_TIMING_DEFAULTS }, priorityWeights: { ...ADAPTIVE_PRIORITY_WEIGHTS }, starvation: { ...STARVATION_DEFAULTS }, pedestrian: { ...PEDESTRIAN_DEFAULTS }, pedestrianProtection: { ...PEDESTRIAN_PROTECTION_DEFAULTS }, emergency: { ...EMERGENCY_DEFAULTS }, sensorHealth: { ...SENSOR_HEALTH_DEFAULTS } };
  }
}
