import { ROAD_NAMES, VEHICLE_TYPES, getTrafficConfig } from './trafficConfig';
import { calculateTrafficDensity, calculateTotalVehicles } from '../algorithms/trafficDensity';
import { classifyTraffic } from '../algorithms/trafficClassification';
import { estimateQueueLength } from '../algorithms/queueEstimator';

export function createVehicleCounts() {
  return VEHICLE_TYPES.reduce((counts, type) => ({ ...counts, [type]: 0 }), {});
}

export function createInitialTrafficState() {
  return Object.keys(ROAD_NAMES).reduce((state, road) => ({ ...state, [road]: createRoadTraffic() }), {});
}

export function createRoadTraffic(vehicleCounts = createVehicleCounts(), overrides = {}) {
  return deriveRoadTraffic(vehicleCounts, overrides);
}

export function normalizeVehicleCounts(vehicleCounts = {}) {
  return VEHICLE_TYPES.reduce((counts, type) => ({
    ...counts,
    [type]: Math.max(0, Number.isFinite(Number(vehicleCounts[type])) ? Math.floor(Number(vehicleCounts[type])) : 0),
  }), {});
}

export function deriveRoadTraffic(vehicleCounts, overrides = {}, config = getTrafficConfig()) {
  const vehicles = normalizeVehicleCounts(vehicleCounts);
  const totalVehicles = calculateTotalVehicles(vehicles);
  const density = calculateTrafficDensity(vehicles, config.weights);
  const waitingTime = Math.max(0, Number(overrides.waitingTime) || 0);
  return {
    vehicles,
    totalVehicles,
    density,
    queueLength: estimateQueueLength({ totalVehicles, waitingTime, arrivalRate: overrides.arrivalRate || 0, signalServing: false }),
    waitingTime,
    status: classifyTraffic(density, totalVehicles, config.thresholds),
  };
}

export function updateTrafficRoad(state, road, vehicleCounts, overrides = {}, config = getTrafficConfig()) {
  return { ...state, [road]: deriveRoadTraffic(vehicleCounts, overrides, config) };
}
