/**
 * Documented Synthetic Traffic Scenario Generator
 *
 * Architecture:
 *   Scenario Selection (off-peak / normal / rush / sudden-surge)
 *     ↓
 *   Scenario Parameters (base traffic, arrival rate, variation, type distribution)
 *     ↓
 *   Seeded Vehicle Arrival Generator (deterministic per-tick)
 *     ↓
 *   Per-Road Queues with individual vehicle records
 *     ↓
 *   Traffic Density / Queue / Waiting Time
 *     ↓
 *   Adaptive Signal Controller
 *
 * Every scenario is fully documented:
 *   - Base traffic level
 *   - Arrival rate (vehicles per second per road)
 *   - Random variation range
 *   - Vehicle type distribution
 *   - Surge timing (if applicable)
 *   - Reproducible via seed
 *
 * Vehicle weights are imported from the centralized trafficConfig.js
 * to prevent duplication across files.
 */

import { VEHICLE_WEIGHTS, VEHICLE_TYPES } from '../data/trafficConfig';
import { createSeededRandom } from './seededRandom';

// ---------------------------------------------------------------------------
// Vehicle type distribution (probability of each type appearing)
// These must sum to 1.0 and are used across all scenarios.
// ---------------------------------------------------------------------------
export const VEHICLE_TYPE_DISTRIBUTION = Object.freeze({
  cycle: 0.12,
  bike:  0.24,
  auto:  0.18,
  car:   0.38,
  heavy: 0.08,
});

// ---------------------------------------------------------------------------
// Scenario definitions — all parameters are documented and centralized.
// ---------------------------------------------------------------------------
export const SCENARIO_DEFINITIONS = Object.freeze({
  offpeak: {
    id: 'offpeak',
    label: 'OFF-PEAK',
    description: 'Low base traffic with minimal vehicle arrivals. Represents late-night or early-morning conditions.',
    baseTraffic: 3,             // Initial vehicles per road
    arrivalRate: 0.18,          // Vehicles per second per road (mean)
    variationRange: [0, 0.15],  // Random arrival variation [min, max] added to arrivalRate
    roadBias: { north: 1.0, south: 1.0, east: 1.0, west: 1.0 }, // Equal demand
    vehicleTypeDistribution: { ...VEHICLE_TYPE_DISTRIBUTION },
    surge: null,                // No surge event
  },

  normal: {
    id: 'normal',
    label: 'NORMAL',
    description: 'Medium base traffic with moderate, balanced arrival rates. Represents typical daytime conditions.',
    baseTraffic: 8,
    arrivalRate: 0.55,
    variationRange: [0, 0.2],
    roadBias: { north: 1.0, south: 1.0, east: 1.0, west: 1.0 },
    vehicleTypeDistribution: { ...VEHICLE_TYPE_DISTRIBUTION },
    surge: null,
  },

  rush: {
    id: 'rush',
    label: 'RUSH HOUR',
    description: 'High base traffic with heavy, continuous vehicle arrivals. North and East approaches see 20% more demand.',
    baseTraffic: 18,
    arrivalRate: 1.15,
    variationRange: [0, 0.3],
    roadBias: { north: 1.2, south: 1.0, east: 1.2, west: 1.0 }, // Slight directional bias
    vehicleTypeDistribution: { ...VEHICLE_TYPE_DISTRIBUTION, car: 0.42, bike: 0.22 }, // More cars in rush
    surge: null,
  },

  surge: {
    id: 'surge',
    label: 'SUDDEN SURGE',
    description: 'Starts as normal traffic. At simulation second 30, West approach arrival rate increases dramatically. Tests adaptive response to sudden demand changes.',
    baseTraffic: 8,
    arrivalRate: 0.55,
    variationRange: [0, 0.2],
    roadBias: { north: 1.0, south: 1.0, east: 1.0, west: 1.0 },
    vehicleTypeDistribution: { ...VEHICLE_TYPE_DISTRIBUTION },
    surge: {
      triggerTime: 30,          // Surge starts at simulation second 30
      road: 'west',             // Affected road
      arrivalMultiplier: 3.5,   // West arrival rate multiplied by 3.5
      description: 'West approach surge: arrival rate ×3.5 at t=30s',
    },
  },
});

// ---------------------------------------------------------------------------
// Scenario Generator Class
// ---------------------------------------------------------------------------

/**
 * Create a new scenario generator instance.
 *
 * @param {string} scenarioId - One of: offpeak, normal, rush, surge
 * @param {number} seed - Integer seed for deterministic replay (default: current timestamp)
 * @returns {object} Generator with advanceTick(), getState(), reset() methods
 */
export function createScenarioGenerator(scenarioId = 'normal', seed = Date.now()) {
  const definition = SCENARIO_DEFINITIONS[scenarioId] || SCENARIO_DEFINITIONS.normal;
  const rng = createSeededRandom(seed);
  let tickCount = 0;
  let totalArrivals = 0;
  const arrivalLog = []; // Log of recent arrivals for debugging

  /**
   * Select a vehicle type using the weighted probability distribution.
   * Uses the seeded PRNG for reproducibility.
   */
  function pickVehicleType() {
    const dist = definition.vehicleTypeDistribution;
    const target = rng.next();
    let cumulative = 0;
    for (const type of VEHICLE_TYPES) {
      cumulative += (dist[type] || 0);
      if (target <= cumulative) return type;
    }
    return 'car'; // Fallback
  }

  /**
   * Generate vehicle arrivals for one simulation tick (1 second).
   *
   * @param {number} simulationTime - Current simulation second
   * @returns {Array<object>} Array of vehicle arrival records
   */
  function generateArrivals(simulationTime) {
    const arrivals = [];
    const roads = ['north', 'south', 'east', 'west'];

    for (const road of roads) {
      // Calculate effective arrival rate for this road
      let effectiveRate = definition.arrivalRate * (definition.roadBias[road] || 1.0);

      // Apply surge if applicable
      if (definition.surge && simulationTime >= definition.surge.triggerTime && road === definition.surge.road) {
        effectiveRate *= definition.surge.arrivalMultiplier;
      }

      // Add random variation (seeded)
      const variation = rng.nextFloat(definition.variationRange[0], definition.variationRange[1]);
      effectiveRate += variation;

      // Poisson-like arrival: floor of rate + chance for fractional part
      const guaranteed = Math.floor(effectiveRate);
      const fractional = effectiveRate - guaranteed;
      const count = guaranteed + (rng.chance(fractional) ? 1 : 0);

      // Cap at reasonable maximum (6 vehicles per tick per road)
      const actualCount = Math.min(6, Math.max(0, count));

      for (let i = 0; i < actualCount; i++) {
        const type = pickVehicleType();
        const vehicle = {
          id: `${road}-${simulationTime}-${totalArrivals}-${rng.next().toString(36).slice(2, 8)}`,
          road,
          vehicleType: type,
          type, // Alias for compatibility with existing simulator
          arrivalTime: Date.now(),
          weight: VEHICLE_WEIGHTS[type],
          status: 'waiting',
          generatedAt: simulationTime,
        };
        arrivals.push(vehicle);
        totalArrivals++;
      }
    }

    // Keep last 100 arrivals in log
    arrivalLog.push(...arrivals);
    if (arrivalLog.length > 100) arrivalLog.splice(0, arrivalLog.length - 100);

    tickCount++;
    return arrivals;
  }

  /**
   * Get the current generator state for debugging/display.
   */
  function getState() {
    return {
      scenarioId: definition.id,
      label: definition.label,
      description: definition.description,
      seed: rng.getSeed(),
      tickCount,
      totalArrivals,
      surgeActive: definition.surge ? tickCount >= definition.surge.triggerTime : false,
      surgeDescription: definition.surge?.description || null,
      recentArrivals: arrivalLog.slice(-20),
    };
  }

  /**
   * Reset the generator (same seed = same sequence).
   */
  function reset(newSeed) {
    rng.reset(newSeed);
    tickCount = 0;
    totalArrivals = 0;
    arrivalLog.length = 0;
  }

  /**
   * Get the scenario definition (for documentation display).
   */
  function getDefinition() {
    return { ...definition };
  }

  return Object.freeze({
    generateArrivals,
    getState,
    getDefinition,
    reset,
    get tickCount() { return tickCount; },
  });
}
