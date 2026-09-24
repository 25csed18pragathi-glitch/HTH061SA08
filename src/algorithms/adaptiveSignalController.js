import { ADAPTIVE_PRIORITY_WEIGHTS, SIGNAL_TIMING_DEFAULTS } from '../data/trafficConfig';
import { validateSignalDecision } from '../safety/SafetyValidator';
import { getPriorityBoost } from './antiStarvation';
import { getPedestrianConfig } from './pedestrianPriority';
import { getEmergencyConfig } from './emergencyManagement';

export const SIGNAL_PHASES = Object.freeze({
  NS: 'ns',
  EW: 'ew',
});

export const SIGNAL_STATES = Object.freeze({
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  ALL_RED: 'ALL RED',
  WALK: 'WALK',
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function phaseForRoad(road) { return road === 'north' || road === 'south' ? SIGNAL_PHASES.NS : SIGNAL_PHASES.EW; }

export function calculatePriority(roadTraffic, weights = ADAPTIVE_PRIORITY_WEIGHTS, starvation, starvationSettings) {
  return (Number(roadTraffic?.density) || 0) * weights.density
    + (Number(roadTraffic?.queueLength) || 0) * weights.queue
    + (Number(roadTraffic?.waitingTime) || 0) * weights.waiting
    + getPriorityBoost(starvation, starvationSettings);
}

  export function calculatePhasePriority(trafficState, phase, weights = ADAPTIVE_PRIORITY_WEIGHTS, starvationState = {}, starvationSettings) {
  const roads = phase === SIGNAL_PHASES.NS ? ['north', 'south'] : ['east', 'west'];
  return roads.reduce((total, road) => total + calculatePriority(trafficState[road], weights, starvationState[road], starvationSettings), 0);
}

export function calculateGreenTime(priority, competingPriority, timing = SIGNAL_TIMING_DEFAULTS) {
  const totalPriority = priority + competingPriority;
  const share = totalPriority > 0 ? priority / totalPriority : 0.5;
  const demand = clamp((priority / 60) * 0.65 + share * 0.35, 0, 1);
  const greenTime = timing.minGreen + Math.round((timing.maxGreen - timing.minGreen) * demand);
  return clamp(greenTime, timing.minGreen, timing.maxGreen);
}

export function selectNextPhase(trafficState, currentPhase, weights = ADAPTIVE_PRIORITY_WEIGHTS, starvationState = {}, starvationSettings) {
  const priorities = {
    [SIGNAL_PHASES.NS]: calculatePhasePriority(trafficState, SIGNAL_PHASES.NS, weights, starvationState, starvationSettings),
    [SIGNAL_PHASES.EW]: calculatePhasePriority(trafficState, SIGNAL_PHASES.EW, weights, starvationState, starvationSettings),
  };
  const nextPhase = priorities[SIGNAL_PHASES.NS] === priorities[SIGNAL_PHASES.EW]
    ? (currentPhase === SIGNAL_PHASES.NS ? SIGNAL_PHASES.EW : SIGNAL_PHASES.NS)
    : priorities[SIGNAL_PHASES.NS] > priorities[SIGNAL_PHASES.EW] ? SIGNAL_PHASES.NS : SIGNAL_PHASES.EW;
  return { nextPhase, priorities };
}

export function getTrafficReason(trafficState, phase, weights = ADAPTIVE_PRIORITY_WEIGHTS, starvationState = {}) {
  const phaseLabel = phase === SIGNAL_PHASES.NS ? 'NS' : 'EW';
  const competingLabel = phase === SIGNAL_PHASES.NS ? 'EW' : 'NS';
  const roads = phase === SIGNAL_PHASES.NS ? ['north', 'south'] : ['east', 'west'];
  const competingRoads = phase === SIGNAL_PHASES.NS ? ['east', 'west'] : ['north', 'south'];
  const density = roads.reduce((total, road) => total + trafficState[road].density, 0);
  const queue = roads.reduce((total, road) => total + trafficState[road].queueLength, 0);
  const waiting = roads.reduce((total, road) => total + trafficState[road].waitingTime, 0);
  const compDensity = competingRoads.reduce((total, road) => total + trafficState[road].density, 0);
  const compQueue = competingRoads.reduce((total, road) => total + trafficState[road].queueLength, 0);
  const factors = [];
  if (roads.some(road => starvationState[road]?.starvationStatus === 'STARVATION PRIORITY')) factors.push('starvation priority');
  if (density > compDensity) factors.push(`higher density (${density.toFixed(1)} vs ${compDensity.toFixed(1)})`);
  if (queue > compQueue) factors.push(`longer queue (${queue} vs ${compQueue})`);
  if (waiting >= 10) factors.push(`waiting time ${waiting}s`);
  if (factors.length === 0) return `Balanced demand — ${phaseLabel} density ${density.toFixed(1)}, queue ${queue}`;
  return `${phaseLabel} selected: ${factors.join(', ')}`;
}

export function createInitialSignalState(trafficState, config, starvationState = {}) {
  const timing = config?.signalTiming || SIGNAL_TIMING_DEFAULTS;
  const priorityWeights = config?.priorityWeights || ADAPTIVE_PRIORITY_WEIGHTS;
  const selection = selectNextPhase(trafficState, SIGNAL_PHASES.EW, priorityWeights, starvationState, config?.starvation);
  const priorities = selection.priorities;
  const phase = selection.nextPhase;
  const competingPhase = phase === SIGNAL_PHASES.NS ? SIGNAL_PHASES.EW : SIGNAL_PHASES.NS;
  const approvedGreen = calculateGreenTime(priorities[phase], priorities[competingPhase], timing);
  return {
    phase,
    state: SIGNAL_STATES.GREEN,
    remaining: approvedGreen,
    currentPriority: priorities[phase],
    requestedGreen: approvedGreen,
    approvedGreen,
    greenElapsed: 0,
    transition: null,
    reason: getTrafficReason(trafficState, phase, priorityWeights, starvationState),
  };
}

export function advanceSignalState(signalState, trafficState, config, starvationState = {}, pedestrianState = {}, emergencyState = {}) {
  const timing = config?.signalTiming || SIGNAL_TIMING_DEFAULTS;
  const priorityWeights = config?.priorityWeights || ADAPTIVE_PRIORITY_WEIGHTS;
  const pedestrian = getPedestrianConfig(config);
  const emergency = getEmergencyConfig(config);
  const emergencyRequest = emergencyState.queue?.[0];
  const emergencyRequested = Boolean(emergencyRequest);
  const pedestrianRequested = Boolean(pedestrianState.pedestrianRequest);

  let nextState;

  if (signalState.state === SIGNAL_STATES.WALK) {
    if (signalState.remaining > 1) {
      nextState = { ...signalState, remaining: signalState.remaining - 1 };
    } else {
      nextState = { ...signalState, state: SIGNAL_STATES.ALL_RED, remaining: timing.allRed, transition: 'PEDESTRIAN_RETURN' };
    }
  } else if (signalState.emergencyGreen && signalState.state === SIGNAL_STATES.GREEN && signalState.remaining <= 1) {
    nextState = { ...signalState, state: SIGNAL_STATES.ALL_RED, remaining: timing.allRed, transition: 'EMERGENCY_RETURN', emergencyGreen: false };
  } else if (signalState.state === SIGNAL_STATES.GREEN && emergencyRequested && (signalState.greenElapsed || 0) >= timing.minGreen) {
    nextState = { ...signalState, state: SIGNAL_STATES.YELLOW, remaining: timing.yellow, transition: 'EMERGENCY' };
  } else if (signalState.state === SIGNAL_STATES.GREEN && pedestrianRequested && (signalState.greenElapsed || 0) >= timing.minGreen) {
    nextState = { ...signalState, state: SIGNAL_STATES.YELLOW, remaining: timing.yellow, transition: 'PEDESTRIAN' };
  } else if (signalState.remaining > 1) {
    nextState = { ...signalState, remaining: signalState.remaining - 1, greenElapsed: signalState.state === SIGNAL_STATES.GREEN ? (signalState.greenElapsed || 0) + 1 : signalState.greenElapsed };
  } else if (signalState.state === SIGNAL_STATES.GREEN) {
    nextState = { ...signalState, state: SIGNAL_STATES.YELLOW, remaining: timing.yellow, transition: emergencyRequested ? 'EMERGENCY' : pedestrianRequested ? 'PEDESTRIAN' : null };
  } else if (signalState.state === SIGNAL_STATES.YELLOW) {
    nextState = { ...signalState, state: SIGNAL_STATES.ALL_RED, remaining: timing.allRed, transition: signalState.transition || (emergencyRequested ? 'EMERGENCY' : pedestrianRequested ? 'PEDESTRIAN' : null) };
  } else if (signalState.state === SIGNAL_STATES.ALL_RED && emergencyRequested && (signalState.transition === 'EMERGENCY' || signalState.transition === 'EMERGENCY_RETURN' || signalState.transition === 'PEDESTRIAN' || !signalState.transition)) {
    nextState = { phase: phaseForRoad(emergencyRequest.road), state: SIGNAL_STATES.GREEN, remaining: emergency.greenDuration, currentPriority: Number.MAX_SAFE_INTEGER, requestedGreen: emergency.greenDuration, approvedGreen: emergency.greenDuration, greenElapsed: 0, transition: null, emergencyGreen: true, emergencyRoad: emergencyRequest.road, emergencyType: emergencyRequest.type, reason: `CRITICAL ${emergencyRequest.type.toUpperCase()}` };
  } else if (signalState.state === SIGNAL_STATES.ALL_RED && signalState.transition === 'EMERGENCY_RETURN' && !emergencyRequested) {
    const { nextPhase, priorities } = selectNextPhase(trafficState, signalState.phase, priorityWeights, starvationState, config?.starvation);
    const requestedGreen = calculateGreenTime(priorities[nextPhase], priorities[nextPhase === SIGNAL_PHASES.NS ? SIGNAL_PHASES.EW : SIGNAL_PHASES.NS], timing);
    nextState = { phase: nextPhase, state: SIGNAL_STATES.GREEN, remaining: requestedGreen, currentPriority: priorities[nextPhase], requestedGreen, approvedGreen: requestedGreen, greenElapsed: 0, transition: null, reason: getTrafficReason(trafficState, nextPhase, priorityWeights, starvationState) };
  } else if (signalState.state === SIGNAL_STATES.ALL_RED && !signalState.transition && pedestrianRequested) {
    if (signalState.remaining > 1) {
      nextState = { ...signalState, remaining: signalState.remaining - 1, transition: 'PEDESTRIAN' };
    } else {
      nextState = { ...signalState, state: SIGNAL_STATES.WALK, remaining: pedestrian.walkDuration, transition: 'PEDESTRIAN_WALK', greenElapsed: 0 };
    }
  } else if (signalState.state === SIGNAL_STATES.ALL_RED && signalState.transition === 'PEDESTRIAN') {
    nextState = { ...signalState, state: SIGNAL_STATES.WALK, remaining: pedestrian.walkDuration, transition: 'PEDESTRIAN_WALK', greenElapsed: 0 };
  } else {
    const { nextPhase, priorities } = selectNextPhase(trafficState, signalState.phase, priorityWeights, starvationState, config?.starvation);
    const requestedGreen = calculateGreenTime(priorities[nextPhase], priorities[nextPhase === SIGNAL_PHASES.NS ? SIGNAL_PHASES.EW : SIGNAL_PHASES.NS], timing);
    nextState = {
      phase: nextPhase,
      state: SIGNAL_STATES.GREEN,
      remaining: requestedGreen,
      currentPriority: priorities[nextPhase],
      requestedGreen,
      approvedGreen: requestedGreen,
      greenElapsed: 0,
      transition: null,
      reason: getTrafficReason(trafficState, nextPhase, priorityWeights, starvationState),
    };
  }

  const validation = validateSignalDecision({
    requestedGreenTime: nextState.requestedGreen ?? nextState.remaining ?? timing.minGreen,
    phase: nextState.phase,
    state: nextState.state,
    previousState: signalState.state,
    minGreen: timing.minGreen,
    maxGreen: timing.maxGreen,
    yellow: timing.yellow,
    allRed: timing.allRed,
    emergencyActive: emergencyRequested,
    pedestrianRequested,
    sensorFallback: false,
    conflictingGreen: false,
    antiStarvationDecision: false,
  });

  return {
    ...nextState,
    requestedGreen: validation.requestedGreenTime,
    approvedGreen: validation.finalGreenTime,
    remaining: nextState.state === SIGNAL_STATES.GREEN ? validation.finalGreenTime : nextState.remaining,
    safetyStatus: validation.safetyStatus,
    safetyReason: validation.reason,
    violations: validation.violations,
    warnings: validation.warnings,
    reason: validation.reason || nextState.reason,
  };
}
