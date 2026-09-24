/**
 * Traffic Simulator — uses the documented Scenario Generator
 *
 * Pipeline:
 *   Scenario Selection → Seeded Vehicle Arrival Generator → Per-Road Queues
 *   → Density / Queue / Waiting Time → Adaptive Signal Controller
 *
 * The generator creates individual vehicle arrivals (with id, road, type, weight).
 * The simulator aggregates those into road-level traffic state.
 *
 * Reproducibility: Same scenario + same seed = same traffic arrivals.
 */

import { VEHICLE_TYPES } from '../data/trafficConfig';
import { createVehicleCounts, deriveRoadTraffic } from '../data/trafficState';
import { createScenarioGenerator, SCENARIO_DEFINITIONS } from './scenarioGenerator';

// ---------------------------------------------------------------------------
// Legacy vehicle probability (kept for backwards compatibility)
// ---------------------------------------------------------------------------
const vehicleProbability = { cycle: 0.12, bike: 0.24, auto: 0.18, car: 0.38, heavy: 0.08 };

function randomVehicleType() {
  const target = Math.random();
  let cursor = 0;
  return VEHICLE_TYPES.find(type => {
    cursor += vehicleProbability[type];
    return target <= cursor;
  }) || 'car';
}

export function generateVehicle(road, now = Date.now()) {
  return {
    id: `${road}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    road,
    type: randomVehicleType(),
    arrivalTime: now,
    status: 'waiting',
  };
}

// ---------------------------------------------------------------------------
// Generator instance management
// ---------------------------------------------------------------------------
let _activeGenerator = null;
let _activeScenario = null;
let _activeSeed = null;

/**
 * Get or create a scenario generator.
 * Reuses the same generator for the same scenario+seed to maintain sequence.
 */
export function getScenarioGenerator(scenario = 'normal', seed = 2026) {
  if (_activeGenerator && _activeScenario === scenario && _activeSeed === seed) {
    return _activeGenerator;
  }
  _activeGenerator = createScenarioGenerator(scenario, seed);
  _activeScenario = scenario;
  _activeSeed = seed;
  return _activeGenerator;
}

/**
 * Reset the generator (call on simulation reset).
 */
export function resetScenarioGenerator() {
  if (_activeGenerator) _activeGenerator.reset();
  _activeGenerator = null;
  _activeScenario = null;
  _activeSeed = null;
}

/**
 * Get the current generator's state for UI display.
 */
export function getGeneratorState() {
  return _activeGenerator ? _activeGenerator.getState() : null;
}

// ---------------------------------------------------------------------------
// Main simulation advance function
// ---------------------------------------------------------------------------

/**
 * Advance the simulation by one tick using the documented scenario generator.
 *
 * @param {object} params
 * @param {object} params.trafficState - Current traffic state for all roads
 * @param {Array} params.vehicles - Current vehicle list
 * @param {string} params.scenario - Scenario ID (offpeak, normal, rush, surge)
 * @param {number} params.now - Current timestamp
 * @param {object} params.config - Traffic config
 * @param {number} params.simulationTime - Current simulation second (for surge timing)
 * @param {number} params.seed - Seed for reproducible generation
 * @returns {{ trafficState: object, vehicles: Array }}
 */
export function advanceSimulation({ trafficState, vehicles, scenario = 'normal', now = Date.now(), config, simulationTime = 0, seed = 2026 }) {
  const generator = getScenarioGenerator(scenario, seed);
  const definition = SCENARIO_DEFINITIONS[scenario] || SCENARIO_DEFINITIONS.normal;

  // Generate new vehicle arrivals for this tick
  const newArrivals = generator.generateArrivals(simulationTime);
  const nextVehicles = [...vehicles, ...newArrivals];
  const nextTraffic = { ...trafficState };

  // Aggregate vehicles into road-level traffic state
  Object.keys(nextTraffic).forEach(road => {
    const roadVehicles = nextVehicles.filter(vehicle => vehicle.road === road && vehicle.status === 'waiting');
    const counts = createVehicleCounts();
    roadVehicles.forEach(vehicle => { counts[vehicle.type] += 1; });
    const waitingTime = roadVehicles.length
      ? Math.round(roadVehicles.reduce((total, vehicle) => total + (now - vehicle.arrivalTime) / 1000, 0) / roadVehicles.length)
      : 0;

    // Calculate effective arrival rate for this road (for display)
    let effectiveRate = definition.arrivalRate * (definition.roadBias?.[road] || 1.0);
    if (definition.surge && simulationTime >= definition.surge.triggerTime && road === definition.surge.road) {
      effectiveRate *= definition.surge.arrivalMultiplier;
    }

    nextTraffic[road] = deriveRoadTraffic(counts, { waitingTime, arrivalRate: effectiveRate }, config);
  });

  return { trafficState: nextTraffic, vehicles: nextVehicles };
}
