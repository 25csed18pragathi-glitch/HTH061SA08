# Synthetic Traffic Scenario Generation

## Overview

The FlowSync2.0 traffic simulation uses a **documented, seeded synthetic traffic scenario generator** to produce deterministic vehicle arrivals. This enables:

- **Reproducible simulations** — same seed + same scenario = same traffic
- **Fair comparison** — Adaptive vs Fixed controllers see identical arrival events
- **Scenario testing** — OFF-PEAK, NORMAL, RUSH HOUR, and SUDDEN SURGE patterns

---

## Architecture

```
Scenario Selection (offpeak / normal / rush / surge)
  ↓
Scenario Parameters (base traffic, arrival rate, variation, type distribution)
  ↓
Seeded Vehicle Arrival Generator (Mulberry32 PRNG)
  ↓
Per-Road Queues with individual vehicle records
  ↓
Traffic Density / Queue / Waiting Time (trafficState)
  ↓
Adaptive Signal Controller
```

### Key Files

| File | Purpose |
|------|---------|
| `src/simulation/seededRandom.js` | Mulberry32 seeded PRNG |
| `src/simulation/scenarioGenerator.js` | Scenario definitions + generator |
| `src/simulation/trafficSimulator.js` | Integrates generator into simulation loop |
| `src/data/trafficConfig.js` | Centralized config (weights, thresholds, timing) |

---

## Seeded Random Number Generator

**Algorithm**: Mulberry32 — a fast 32-bit PRNG with good statistical properties.

```javascript
import { createSeededRandom } from './simulation/seededRandom';

const rng = createSeededRandom(2026);
rng.next();          // Float in [0, 1)
rng.nextInt(1, 10);  // Integer in [1, 10]
rng.chance(0.3);     // true with 30% probability
rng.pick(['a','b']); // Random element
rng.reset();         // Restart from same seed
```

**Reproducibility guarantee**: Two generators with the same seed will produce the exact same sequence of random numbers, regardless of when or where they run.

---

## Scenario Definitions

### OFF-PEAK

| Parameter | Value |
|-----------|-------|
| Base traffic | 3 vehicles/road |
| Arrival rate | 0.18 veh/sec/road |
| Variation | [0, 0.15] |
| Road bias | Equal (1.0 all) |
| Surge | None |
| Description | Late-night/early-morning, minimal traffic |

### NORMAL

| Parameter | Value |
|-----------|-------|
| Base traffic | 8 vehicles/road |
| Arrival rate | 0.55 veh/sec/road |
| Variation | [0, 0.2] |
| Road bias | Equal (1.0 all) |
| Surge | None |
| Description | Typical daytime, moderate balanced traffic |

### RUSH HOUR

| Parameter | Value |
|-----------|-------|
| Base traffic | 18 vehicles/road |
| Arrival rate | 1.15 veh/sec/road |
| Variation | [0, 0.3] |
| Road bias | North 1.2, South 1.0, East 1.2, West 1.0 |
| Surge | None |
| Description | Heavy continuous traffic, directional bias |

### SUDDEN SURGE

| Parameter | Value |
|-----------|-------|
| Base traffic | 8 vehicles/road |
| Arrival rate | 0.55 veh/sec/road (baseline) |
| Variation | [0, 0.2] |
| Road bias | Equal (baseline) |
| Surge | West approach × 3.5 at t=30s |
| Description | Tests adaptive response to sudden demand spike |

---

## Vehicle Type Distribution

All scenarios use a weighted vehicle type distribution:

| Type | Probability | Weight |
|------|-------------|--------|
| Cycle | 12% | 0.1 |
| Bike | 24% | 0.2 |
| Auto | 18% | 0.3 |
| Car | 38% | 0.4 |
| Heavy | 8% | 1.0 |

> **Rush hour exception**: Cars increase to 42%, bikes decrease to 22%.

Vehicle weights are imported from `trafficConfig.js` to avoid duplication.

---

## Arrival Mechanism

Each simulation tick (1 second), for each road:

1. **Calculate effective arrival rate**:
   ```
   effectiveRate = baseRate × roadBias[road]
   ```

2. **Apply surge** (if applicable):
   ```
   if (simulationTime >= surge.triggerTime && road === surge.road):
     effectiveRate *= surge.arrivalMultiplier
   ```

3. **Add random variation** (seeded):
   ```
   effectiveRate += rng.nextFloat(variationRange[0], variationRange[1])
   ```

4. **Poisson-like arrival**:
   ```
   guaranteed = floor(effectiveRate)
   fractional = effectiveRate - guaranteed
   count = guaranteed + (rng.chance(fractional) ? 1 : 0)
   ```

5. **Cap at 6 vehicles/tick/road** (safety limit)

6. **For each arrival**: Pick vehicle type using weighted distribution (seeded)

---

## Reproducibility with Seeds

### Using Seeds

```javascript
// Same seed = same traffic
const gen1 = createScenarioGenerator('normal', 2026);
const gen2 = createScenarioGenerator('normal', 2026);

// gen1.generateArrivals(0) === gen2.generateArrivals(0)  ✓
```

### In the UI

The seed is configurable in the simulation controls:
- Default seed: `2026`
- Change via the "Seed" input field
- Same seed + same scenario = same vehicle sequence

### For Fair Comparison

To compare Adaptive vs Fixed controllers:
1. Set the same seed for both runs
2. Select the same scenario
3. Both controllers receive identical arrival events
4. Differences in performance are due to the algorithm, not traffic variation

---

## Generator API

```javascript
import { createScenarioGenerator } from './simulation/scenarioGenerator';

const gen = createScenarioGenerator('rush', 42);

// Generate arrivals for simulation tick 0
const arrivals = gen.generateArrivals(0);
// → [{ id, road, vehicleType, type, weight, arrivalTime, status, generatedAt }, ...]

// Get current state
const state = gen.getState();
// → { scenarioId, label, description, seed, tickCount, totalArrivals, surgeActive, ... }

// Get the scenario definition
const def = gen.getDefinition();
// → { id, label, description, baseTraffic, arrivalRate, variationRange, ... }

// Reset to original seed
gen.reset();
```

---

## Integration with Simulation Loop

The `advanceSimulation()` function in `trafficSimulator.js`:

1. Gets or creates a scenario generator (reusing for same scenario+seed)
2. Calls `generator.generateArrivals(simulationTime)`
3. Merges new arrivals into the vehicle list
4. Aggregates per-road counts into traffic state
5. Returns `{ trafficState, vehicles }` for the next tick

The generator instance is managed internally — same scenario+seed reuses the same generator to maintain the sequence.

---

## Adding New Scenarios

To add a new scenario:

1. Add the definition to `SCENARIO_DEFINITIONS` in `scenarioGenerator.js`:

```javascript
myScenario: {
  id: 'myScenario',
  label: 'MY SCENARIO',
  description: 'Description of the scenario.',
  baseTraffic: 10,
  arrivalRate: 0.7,
  variationRange: [0, 0.25],
  roadBias: { north: 1.0, south: 1.0, east: 1.5, west: 1.0 },
  vehicleTypeDistribution: { ...VEHICLE_TYPE_DISTRIBUTION },
  surge: null, // or { triggerTime: 60, road: 'east', arrivalMultiplier: 2.0, description: '...' }
},
```

2. Add the scenario to `SIMULATION_SCENARIOS` in `trafficConfig.js`
3. Add the button in `SimulationControls` component
