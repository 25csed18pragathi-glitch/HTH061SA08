/**
 * Pedestrian Priority System with Protection
 *
 * Features:
 *   1. DEBOUNCE — Ignores repeated button presses within PEDESTRIAN_DEBOUNCE_MS
 *   2. DEDUPLICATION — Only one pending request at a time; additional presses are ignored
 *   3. COOLDOWN — After a pedestrian phase is served, new requests are blocked for PEDESTRIAN_COOLDOWN_MS
 *
 * All configurable values come from the centralized trafficConfig.js.
 */

import { PEDESTRIAN_PROTECTION_DEFAULTS } from '../data/trafficConfig';

export const PEDESTRIAN_STATES = Object.freeze({ DONT_WALK: "DON'T WALK", WALK: 'WALK' });
export const PEDESTRIAN_DEFAULTS = Object.freeze({ walkDuration: 15, highDemandCount: 25, maxPendingRequests: 3 });

export function classifyPedestrianDemand(count, settings = PEDESTRIAN_DEFAULTS) {
  return count >= settings.highDemandCount ? 'HIGH' : 'NORMAL';
}

export function createInitialPedestrianState() {
  return {
    pedestrianRequest: false,
    pedestrianCount: 0,
    pendingRequests: 0,
    demand: 'NORMAL',
    phase: PEDESTRIAN_STATES.DONT_WALK,
    countdown: 0,
    // Protection fields
    lastRequestTime: 0,           // Timestamp of last accepted request (for debounce)
    requestCount: 0,              // Total accepted requests in current cycle
    status: 'IDLE',               // IDLE | PENDING | WALK | COOLDOWN
    cooldownEndsAt: 0,            // Timestamp when cooldown expires
    lastRejectionReason: null,    // Why the last press was rejected (for UI)
  };
}

export function setPedestrianCount(state, count, settings = PEDESTRIAN_DEFAULTS) {
  const pedestrianCount = Math.max(0, Math.floor(Number(count) || 0));
  return { ...state, pedestrianCount, demand: classifyPedestrianDemand(pedestrianCount, settings) };
}

/**
 * Register a pedestrian crossing request WITH protection.
 *
 * Protection rules:
 *   1. If a request is already pending (status === 'PENDING'), reject (dedup)
 *   2. If cooldown is active, reject
 *   3. If last accepted request was within debounceMs, reject (debounce)
 *   4. Otherwise, accept exactly ONE request
 *
 * @param {object} state - Current pedestrian state
 * @param {number} count - Number of pedestrians waiting
 * @param {object} settings - Pedestrian settings (walkDuration, highDemandCount, etc.)
 * @param {object} protection - Protection settings (debounceMs, cooldownMs)
 * @param {number} now - Current timestamp (for testability)
 * @returns {object} Next state
 */
export function registerPedestrianRequest(
  state,
  count,
  settings = PEDESTRIAN_DEFAULTS,
  protection = PEDESTRIAN_PROTECTION_DEFAULTS,
  now = Date.now(),
) {
  const next = setPedestrianCount(state, count, settings);

  // Rule 1: Deduplication — already pending
  if (state.pedestrianRequest || state.status === 'PENDING') {
    return { ...next, lastRejectionReason: 'Request already pending — no duplicate created.' };
  }

  // Rule 2: Cooldown active
  if (state.status === 'COOLDOWN' && now < state.cooldownEndsAt) {
    const remaining = Math.ceil((state.cooldownEndsAt - now) / 1000);
    return {
      ...next,
      lastRejectionReason: `Pedestrian crossing temporarily unavailable — cooldown active (${remaining}s remaining).`,
    };
  }

  // Rule 3: Debounce — too soon after last accepted request
  if (state.lastRequestTime && (now - state.lastRequestTime) < protection.debounceMs) {
    return { ...next, lastRejectionReason: 'Request ignored — too soon after last press (debounce).' };
  }

  // Accept the request
  return {
    ...next,
    pedestrianRequest: true,
    pendingRequests: 1,           // Always exactly 1 pending request
    requestCount: next.requestCount + 1,
    lastRequestTime: now,
    status: 'PENDING',
    lastRejectionReason: null,
  };
}

/**
 * Update pedestrian state based on signal transitions.
 * Handles WALK entry, WALK exit (start cooldown), and normal ticks.
 */
export function updatePedestrianState(previous, previousSignal, nextSignal, protection = PEDESTRIAN_PROTECTION_DEFAULTS, now = Date.now()) {
  const enteringWalk = nextSignal.state === 'WALK' && previousSignal.state !== 'WALK';
  const leavingWalk = previousSignal.state === 'WALK' && nextSignal.state === 'ALL RED';

  if (enteringWalk) {
    return {
      ...previous,
      pedestrianRequest: false,
      pendingRequests: 0,
      phase: PEDESTRIAN_STATES.WALK,
      countdown: nextSignal.remaining,
      status: 'WALK',
      lastRejectionReason: null,
    };
  }

  if (leavingWalk) {
    // Start cooldown after WALK phase completes
    return {
      ...previous,
      pedestrianRequest: false,
      pendingRequests: 0,
      pedestrianCount: 0,
      phase: PEDESTRIAN_STATES.DONT_WALK,
      countdown: 0,
      status: 'COOLDOWN',
      cooldownEndsAt: now + protection.cooldownMs,
      requestCount: 0,
      lastRejectionReason: null,
    };
  }

  // During WALK
  if (nextSignal.state === 'WALK') {
    return { ...previous, phase: PEDESTRIAN_STATES.WALK, countdown: nextSignal.remaining, status: 'WALK' };
  }

  // Check if cooldown has expired
  if (previous.status === 'COOLDOWN' && now >= previous.cooldownEndsAt) {
    return {
      ...previous,
      phase: PEDESTRIAN_STATES.DONT_WALK,
      countdown: 0,
      status: 'IDLE',
      cooldownEndsAt: 0,
      lastRejectionReason: null,
    };
  }

  return { ...previous, phase: PEDESTRIAN_STATES.DONT_WALK, countdown: 0 };
}

export function getPedestrianConfig(config) {
  return {
    walkDuration: Number(config?.pedestrian?.walkDuration) || PEDESTRIAN_DEFAULTS.walkDuration,
    highDemandCount: Number(config?.pedestrian?.highDemandCount) || PEDESTRIAN_DEFAULTS.highDemandCount,
    maxPendingRequests: Number(config?.pedestrian?.maxPendingRequests) || PEDESTRIAN_DEFAULTS.maxPendingRequests,
  };
}

/**
 * Get cooldown remaining in seconds (for UI display).
 */
export function getCooldownRemaining(state, now = Date.now()) {
  if (state.status !== 'COOLDOWN') return 0;
  return Math.max(0, Math.ceil((state.cooldownEndsAt - now) / 1000));
}
