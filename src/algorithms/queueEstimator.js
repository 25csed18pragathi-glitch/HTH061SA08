export function estimateQueueLength({ totalVehicles = 0, waitingTime = 0, arrivalRate = 0, signalServing = false } = {}) {
  const stoppedTraffic = signalServing ? 0 : totalVehicles * 0.2;
  return Math.min(totalVehicles, Math.max(0, Math.round(stoppedTraffic + waitingTime * 0.15 + arrivalRate * 2)));
}
