import { EMERGENCY_DEFAULTS, EMERGENCY_TYPES, ROAD_NAMES } from '../data/trafficConfig';

export const EMERGENCY_STATUS = Object.freeze({ CLEAR: 'CLEARED', ACTIVE: 'ACTIVE' });

export function getEmergencyConfig(config) {
  return {
    greenDuration: Number(config?.emergency?.greenDuration) || EMERGENCY_DEFAULTS.greenDuration,
    maxQueue: Number(config?.emergency?.maxQueue) || EMERGENCY_DEFAULTS.maxQueue,
  };
}

export function createInitialEmergencyState() {
  return {
    status: EMERGENCY_STATUS.CLEAR,
    queue: [],
    active: null,
    detectionTime: null,
    emergencyGreenTime: null,
    clearanceTime: null,
    responseTime: null,
  };
}

export function registerEmergency(state, road, type = EMERGENCY_TYPES[0], now = Date.now(), config) {
  if (!ROAD_NAMES[road] || !EMERGENCY_TYPES.includes(type)) return state;
  const settings = getEmergencyConfig(config);
  const duplicate = state.queue.some(item => item.road === road && item.type === type) || state.active?.road === road;
  if (duplicate) return state;
  const request = { id: `${road}-${now}`, road, type, detectedAt: now };
  return {
    ...state,
    status: EMERGENCY_STATUS.ACTIVE,
    queue: [...state.queue, request].slice(0, settings.maxQueue),
    detectionTime: state.detectionTime || now,
    clearanceTime: null,
  };
}

export function updateEmergencyState(previous, previousSignal, nextSignal, now = Date.now()) {
  const enteringEmergency = nextSignal.emergencyGreen && !previousSignal.emergencyGreen;
  const clearingEmergency = previousSignal.emergencyGreen && nextSignal.state === 'ALL RED' && nextSignal.transition === 'EMERGENCY_RETURN';
  if (enteringEmergency && previous.queue.length) {
    const request = previous.queue[0];
    return {
      ...previous,
      active: request,
      status: EMERGENCY_STATUS.ACTIVE,
      detectionTime: request.detectedAt,
      emergencyGreenTime: now,
      responseTime: Math.max(0, now - request.detectedAt),
    };
  }
  if (clearingEmergency) {
    const remaining = previous.queue.slice(1);
    return {
      ...previous,
      active: null,
      queue: remaining,
      status: remaining.length ? EMERGENCY_STATUS.ACTIVE : EMERGENCY_STATUS.CLEAR,
      clearanceTime: now,
    };
  }
  return previous;
}

export function formatEmergencyQueue(queue) {
  return queue.map(item => ROAD_NAMES[item.road]).join(' → ');
}
