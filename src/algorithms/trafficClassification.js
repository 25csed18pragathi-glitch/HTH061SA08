import { TRAFFIC_THRESHOLDS } from '../data/trafficConfig';

export function classifyTraffic(density, totalVehicles, thresholds = TRAFFIC_THRESHOLDS) {
  if (totalVehicles > thresholds.rushVehicles || density >= thresholds.rushDensity) return 'RUSH';
  if (totalVehicles >= thresholds.highVehicles || density >= thresholds.highDensity) return 'HIGH';
  if (totalVehicles >= thresholds.normalVehicles || density >= thresholds.normalDensity) return 'NORMAL';
  return 'LOW';
}
