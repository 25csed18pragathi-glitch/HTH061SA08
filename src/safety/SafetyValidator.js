export const SAFETY_STATUS = Object.freeze({
  SAFE: 'SAFE',
  CORRECTED: 'CORRECTED',
  BLOCKED: 'BLOCKED',
});

export function validateSignalDecision({
  requestedGreenTime = 0,
  phase = null,
  state = 'GREEN',
  previousState = null,
  minGreen = 10,
  maxGreen = 50,
  yellow = 3,
  allRed = 2,
  emergencyActive = false,
  pedestrianRequested = false,
  sensorFallback = false,
  conflictingGreen = false,
  antiStarvationDecision = false,
}) {
  const violations = [];
  const warnings = [];
  const requested = Number(requestedGreenTime) || 0;
  let finalGreenTime = requested;

  if (state === 'GREEN') {
    if (requested < minGreen) {
      violations.push(`Minimum green violated (${requested}s < ${minGreen}s)`);
      finalGreenTime = minGreen;
    }
    if (requested > maxGreen) {
      violations.push(`Maximum green violated (${requested}s > ${maxGreen}s)`);
      finalGreenTime = maxGreen;
    }
  }

  if (state === 'YELLOW' && requested !== yellow) {
    warnings.push(`Yellow duration corrected from ${requested}s to ${yellow}s`);
    finalGreenTime = yellow;
  }

  if (state === 'ALL RED' && requested !== allRed) {
    warnings.push(`All-red duration corrected from ${requested}s to ${allRed}s`);
    finalGreenTime = allRed;
  }

  if (conflictingGreen) {
    violations.push('Conflicting green phase rejected by safety validator.');
  }

  if (emergencyActive && pedestrianRequested) {
    warnings.push('Emergency has priority over pedestrian phase.');
  }

  if (sensorFallback) {
    warnings.push('Sensor fallback uses fixed-timing safety mode.');
  }

  if (antiStarvationDecision) {
    warnings.push('Anti-starvation priority boost is active but not bypassing safety.');
  }

  if (previousState === 'GREEN' && state === 'YELLOW') {
    warnings.push('Safe transition to yellow is required before all-red.');
  }

  if (conflictingGreen || violations.length > 0) {
    return {
      approved: false,
      requestedGreenTime: requested,
      finalGreenTime,
      violations,
      warnings,
      safetyStatus: SAFETY_STATUS.BLOCKED,
      reason: violations[0] || 'Signal decision blocked by safety validation.',
    };
  }

  if (warnings.length > 0) {
    return {
      approved: true,
      requestedGreenTime: requested,
      finalGreenTime,
      violations: [],
      warnings,
      safetyStatus: SAFETY_STATUS.CORRECTED,
      reason: warnings[0],
    };
  }

  return {
    approved: true,
    requestedGreenTime: requested,
    finalGreenTime,
    violations: [],
    warnings: [],
    safetyStatus: SAFETY_STATUS.SAFE,
    reason: `Signal decision approved for ${phase || 'current'} ${state.toLowerCase()} phase.`,
  };
}
