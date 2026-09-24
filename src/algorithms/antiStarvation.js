import { ROAD_NAMES, STARVATION_DEFAULTS } from '../data/trafficConfig';

export const STARVATION_STATUS = Object.freeze({
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  PRIORITY: 'STARVATION PRIORITY',
});

export function calculateStarvationScore(roadState, weights = STARVATION_DEFAULTS) {
  return (Number(roadState?.waitingTime) || 0) * weights.waitingWeight
    + (Number(roadState?.consecutiveRedCycles) || 0) * weights.cycleWeight;
}

export function getStarvationStatus(waitingTime, settings = STARVATION_DEFAULTS) {
  if (waitingTime >= settings.threshold) return STARVATION_STATUS.PRIORITY;
  if (waitingTime >= settings.threshold * settings.warningRatio) return STARVATION_STATUS.WARNING;
  return STARVATION_STATUS.NORMAL;
}

export function getPriorityBoost(starvation, settings = STARVATION_DEFAULTS) {
  return starvation?.starvationStatus === STARVATION_STATUS.PRIORITY
    ? starvation.starvationScore * settings.boostWeight
    : 0;
}

export function createInitialStarvationState() {
  return Object.keys(ROAD_NAMES).reduce((state, road) => ({
    ...state,
    [road]: {
      waitingTime: 0,
      lastGreenTime: 0,
      consecutiveRedCycles: 0,
      starvationScore: 0,
      starvationStatus: STARVATION_STATUS.NORMAL,
      priorityBoost: 0,
    },
  }), {});
}

function phaseIncludesRoad(phase, road) {
  return phase === 'ns' ? road === 'north' || road === 'south' : road === 'east' || road === 'west';
}

export function updateStarvationState(previous, trafficState, currentSignal, nextSignal, elapsedSeconds, settings = STARVATION_DEFAULTS) {
  const phaseStarted = nextSignal.state === 'GREEN' && (currentSignal.state === 'ALL RED' || nextSignal.phase !== currentSignal.phase);
  return Object.keys(ROAD_NAMES).reduce((state, road) => {
    const wasServed = currentSignal.state === 'GREEN' && phaseIncludesRoad(currentSignal.phase, road);
    const isServed = nextSignal.state === 'GREEN' && phaseIncludesRoad(nextSignal.phase, road);
    const hasWaitingVehicles = trafficState[road].totalVehicles > 0;
    const previousRoad = previous[road];
    const waitingTime = (wasServed || isServed) ? 0 : hasWaitingVehicles ? previousRoad.waitingTime + 1 : 0;
    const consecutiveRedCycles = isServed ? 0 : phaseStarted && !isServed ? previousRoad.consecutiveRedCycles + 1 : previousRoad.consecutiveRedCycles;
    const starvationStatus = getStarvationStatus(waitingTime, settings);
    const nextRoad = {
      waitingTime,
      lastGreenTime: isServed ? elapsedSeconds : previousRoad.lastGreenTime,
      consecutiveRedCycles,
      starvationScore: 0,
      starvationStatus,
      priorityBoost: 0,
    };
    nextRoad.starvationScore = calculateStarvationScore(nextRoad, settings);
    nextRoad.priorityBoost = getPriorityBoost(nextRoad, settings);
    return { ...state, [road]: nextRoad };
  }, {});
}
