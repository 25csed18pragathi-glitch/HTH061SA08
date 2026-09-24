import { VEHICLE_WEIGHTS, VEHICLE_TYPES } from '../data/trafficConfig';

export function calculateTotalVehicles(vehicleCounts = {}) {
  return VEHICLE_TYPES.reduce((total, type) => total + (Number(vehicleCounts[type]) || 0), 0);
}

export function calculateTrafficDensity(vehicleCounts = {}, weights = VEHICLE_WEIGHTS) {
  return VEHICLE_TYPES.reduce((density, type) => density + (Number(vehicleCounts[type]) || 0) * weights[type], 0);
}
