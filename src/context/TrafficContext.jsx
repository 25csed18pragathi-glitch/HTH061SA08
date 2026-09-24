import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTrafficConfig } from '../data/trafficConfig';
import { createInitialTrafficState, deriveRoadTraffic, updateTrafficRoad } from '../data/trafficState';
import { advanceSimulation, resetScenarioGenerator, getGeneratorState } from '../simulation/trafficSimulator';
import { advanceSignalState, calculatePhasePriority, createInitialSignalState, getTrafficReason } from '../algorithms/adaptiveSignalController';
import { createInitialStarvationState, updateStarvationState } from '../algorithms/antiStarvation';
import { createInitialPedestrianState, getPedestrianConfig, registerPedestrianRequest, setPedestrianCount, updatePedestrianState, getCooldownRemaining } from '../algorithms/pedestrianPriority';
import { createInitialEmergencyState, registerEmergency, updateEmergencyState } from '../algorithms/emergencyManagement';
import { createInitialSensorState, evaluateSensorHealth, recordSensorData, isSensorHealthy, getSensorSummary, getSensorCounts } from '../algorithms/sensorHealth';
import { fetchHealth, postTrafficRecords, postSignalEvent } from '../utils/api';

const TrafficContext = createContext(null);

export function TrafficProvider({ children }) {
  const [config, setConfig] = useState(() => getTrafficConfig());
  const [trafficState, setTrafficState] = useState(() => createInitialTrafficState());
  const [vehicles, setVehicles] = useState([]);
  const [mode, setMode] = useState('simulation');
  const [scenario, setScenario] = useState('normal');
  const [isRunning, setIsRunning] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [signalState, setSignalState] = useState(() => createInitialSignalState(trafficState, config));
  const [starvationState, setStarvationState] = useState(() => createInitialStarvationState());
  const [pedestrianState, setPedestrianState] = useState(() => createInitialPedestrianState());
  const [emergencyState, setEmergencyState] = useState(() => createInitialEmergencyState());
  const [sensorState, setSensorState] = useState(() => createInitialSensorState());
  const [sensorEvents, setSensorEvents] = useState([]);
  const [simulationSeed, setSimulationSeed] = useState(2026);
  const [backendStatus, setBackendStatus] = useState('unknown');
  const [databaseStatus, setDatabaseStatus] = useState('unknown');
  const [videoServiceStatus, setVideoServiceStatus] = useState('unknown');
  const trafficRef = useRef(trafficState);
  const vehiclesRef = useRef(vehicles);
  const signalRef = useRef(signalState);
  const starvationRef = useRef(starvationState);
  const pedestrianRef = useRef(pedestrianState);
  const emergencyRef = useRef(emergencyState);
  const sensorRef = useRef(sensorState);
  const simulationTimeRef = useRef(simulationTime);
  trafficRef.current = trafficState;
  vehiclesRef.current = vehicles;
  signalRef.current = signalState;
  starvationRef.current = starvationState;
  pedestrianRef.current = pedestrianState;
  emergencyRef.current = emergencyState;
  sensorRef.current = sensorState;
  simulationTimeRef.current = simulationTime;

  useEffect(() => {
    const refreshConfig = () => {
      const nextConfig = getTrafficConfig();
      setConfig(nextConfig);
      setSignalState(current => ({
        ...current,
        currentPriority: calculatePhasePriority(trafficRef.current, current.phase, nextConfig.priorityWeights, starvationRef.current, nextConfig.starvation),
        reason: getTrafficReason(trafficRef.current, current.phase, nextConfig.priorityWeights, starvationRef.current),
        remaining: current.state === 'GREEN' ? Math.min(current.remaining, nextConfig.signalTiming.maxGreen) : current.remaining,
        requestedGreen: Math.min(current.requestedGreen, nextConfig.signalTiming.maxGreen),
        approvedGreen: Math.min(current.approvedGreen, nextConfig.signalTiming.maxGreen),
      }));
    };
    window.addEventListener('traffic-settings-updated', refreshConfig);
    window.addEventListener('storage', refreshConfig);
    return () => {
      window.removeEventListener('traffic-settings-updated', refreshConfig);
      window.removeEventListener('storage', refreshConfig);
    };
  }, []);

  // Periodic backend health check (every 10 seconds)
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const result = await fetchHealth();
      if (!alive) return;

      const nextBackendStatus = result.ok && result.data?.server_status === 'ok' ? 'connected' : 'disconnected';
      const nextDatabaseStatus = result.data?.database_status || 'disconnected';
      const nextVideoStatus = result.data?.python_service_status || 'disconnected';

      setBackendStatus(nextBackendStatus);
      setDatabaseStatus(nextDatabaseStatus);
      setVideoServiceStatus(nextVideoStatus);
    };
    check();
    const id = window.setInterval(check, 10_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!isRunning || mode !== 'simulation') return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const currentSimTime = simulationTimeRef.current;
      const result = advanceSimulation({ trafficState: trafficRef.current, vehicles: vehiclesRef.current, scenario, config, now, simulationTime: currentSimTime, seed: simulationSeed });

      // Record sensor data for all roads (simulation = always fresh data)
      let nextSensor = sensorRef.current;
      for (const road of ['north', 'south', 'east', 'west']) {
        if (isSensorHealthy(nextSensor, road) || nextSensor[road]?.status === 'OFFLINE') {
          nextSensor = recordSensorData(nextSensor, road, now);
        }
      }
      // Evaluate sensor health (timeout checks)
      const sensorResult = evaluateSensorHealth(nextSensor, now, config.sensorHealth);
      nextSensor = sensorResult.state;
      if (sensorResult.events.length > 0) {
        setSensorEvents(prev => [...sensorResult.events, ...prev].slice(0, 100));
      }
      sensorRef.current = nextSensor;
      setSensorState(nextSensor);

      const nextSignal = advanceSignalState(signalRef.current, result.trafficState, config, starvationRef.current, pedestrianRef.current, emergencyRef.current);
      // Fire-and-forget signal event logging to MongoDB when the database is reachable.
      if (databaseStatus === 'connected' && (nextSignal.state !== signalRef.current.state || nextSignal.phase !== signalRef.current.phase)) {
        postSignalEvent({
          phase: nextSignal.phase,
          state: nextSignal.state,
          previousState: signalRef.current.state,
          remaining: nextSignal.remaining,
          requestedGreen: nextSignal.requestedGreen,
          approvedGreen: nextSignal.approvedGreen,
          currentPriority: nextSignal.currentPriority,
          reason: nextSignal.reason,
          safetyStatus: nextSignal.safetyStatus || 'SAFE',
        }).catch(() => {});
      }
      const nextStarvation = updateStarvationState(starvationRef.current, result.trafficState, signalRef.current, nextSignal, simulationTimeRef.current + 1, config.starvation);
      const nextPedestrian = updatePedestrianState(pedestrianRef.current, signalRef.current, nextSignal, config.pedestrianProtection, now);
      const nextEmergency = updateEmergencyState(emergencyRef.current, signalRef.current, nextSignal, now);
      trafficRef.current = result.trafficState;
      vehiclesRef.current = result.vehicles;
      signalRef.current = nextSignal;
      starvationRef.current = nextStarvation;
      pedestrianRef.current = nextPedestrian;
      emergencyRef.current = nextEmergency;
      setTrafficState(result.trafficState);
      setVehicles(result.vehicles);
      setSignalState(nextSignal);
      setStarvationState(nextStarvation);
      setPedestrianState(nextPedestrian);
      setEmergencyState(nextEmergency);
      setSimulationTime(current => {
        const nextTick = current + 1;
        // Fire-and-forget POST every 5 ticks
        if (nextTick % 5 === 0 && databaseStatus === 'connected') {
          const records = Object.entries(result.trafficState).map(([road, data]) => ({
            road,
            cycle: data.vehicles.cycle,
            bike: data.vehicles.bike,
            auto: data.vehicles.auto,
            car: data.vehicles.car,
            heavy: data.vehicles.heavy,
            totalVehicles: data.totalVehicles,
            density: data.density,
            queueLength: data.queueLength,
            waitingTime: data.waitingTime,
            trafficStatus: data.status,
            source: 'simulation',
          }));
          postTrafficRecords(records).then(res => {
            if (res.ok) setDatabaseStatus('connected');
            else if (res.status === 0) setDatabaseStatus('disconnected');
          });
        }
        return nextTick;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [config, isRunning, mode, scenario, simulationSeed]);

  const updateManualCount = (road, type, value) => {
    setMode('manual');
    setIsRunning(false);
    setTrafficState(current => {
      const nextState = updateTrafficRoad(current, road, { ...current[road].vehicles, [type]: value }, {}, config);
      setSignalState(createInitialSignalState(nextState, config, starvationRef.current));
      return nextState;
    });
  };

  const startSimulation = () => { setMode('simulation'); setIsRunning(true); };
  const pauseSimulation = () => setIsRunning(false);
  const requestPedestrianCrossing = count => setPedestrianState(current => {
    const next = registerPedestrianRequest(current, count, getPedestrianConfig(config), config.pedestrianProtection, Date.now());
    pedestrianRef.current = next;
    return next;
  });
  const updatePedestrianCount = count => setPedestrianState(current => {
    const next = setPedestrianCount(current, count, getPedestrianConfig(config));
    pedestrianRef.current = next;
    return next;
  });
  const reportEmergency = (road, type) => setEmergencyState(current => {
    const next = registerEmergency(current, road, type, Date.now(), config);
    emergencyRef.current = next;
    return next;
  });
  const resetTraffic = () => {
    setIsRunning(false);
    setVehicles([]);
    setSimulationTime(0);
    const nextState = createInitialTrafficState();
    const nextStarvation = createInitialStarvationState();
    const nextPedestrian = createInitialPedestrianState();
    const nextEmergency = createInitialEmergencyState();
    const nextSensor = createInitialSensorState();
    trafficRef.current = nextState;
    vehiclesRef.current = [];
    starvationRef.current = nextStarvation;
    pedestrianRef.current = nextPedestrian;
    emergencyRef.current = nextEmergency;
    sensorRef.current = nextSensor;
    setTrafficState(nextState);
    setStarvationState(nextStarvation);
    setPedestrianState(nextPedestrian);
    setEmergencyState(nextEmergency);
    setSensorState(nextSensor);
    setSensorEvents([]);
    resetScenarioGenerator();
    setSignalState(createInitialSignalState(nextState, config, nextStarvation));
  };

  // Manual-entry sync: fire-and-forget POST when user updates a road manually
  const syncManualTraffic = useCallback((nextState, source) => {
    const records = Object.entries(nextState).map(([road, data]) => ({
      road,
      cycle: data.vehicles.cycle,
      bike: data.vehicles.bike,
      auto: data.vehicles.auto,
      car: data.vehicles.car,
      heavy: data.vehicles.heavy,
      totalVehicles: data.totalVehicles,
      density: data.density,
      queueLength: data.queueLength,
      waitingTime: data.waitingTime,
      trafficStatus: data.status,
      source: source || 'manual',
    }));
    postTrafficRecords(records).catch(() => {});
  }, []);

  const applyVideoAnalysis = useCallback((road, vehicleCounts) => {
    setMode('video');
    setIsRunning(false);
    setTrafficState(current => {
      const nextState = updateTrafficRoad(current, road, vehicleCounts, {}, config);
      setSignalState(createInitialSignalState(nextState, config, starvationRef.current));
      syncManualTraffic(nextState, 'video');
      return nextState;
    });
  }, [config, syncManualTraffic]);

  const value = useMemo(() => ({
    trafficState,
    signalState,
    starvationState,
    pedestrianState,
    emergencyState,
    sensorState,
    sensorEvents,
    config,
    mode,
    scenario,
    isRunning,
    simulationTime,
    simulationSeed,
    backendStatus,
    databaseStatus,
    videoServiceStatus,
    setScenario,
    setMode,
    setSimulationSeed,
    startSimulation,
    pauseSimulation,
    resetTraffic,
    updateManualCount,
    requestPedestrianCrossing,
    updatePedestrianCount,
    reportEmergency,
    syncManualTraffic,
    applyVideoAnalysis,
    generatorState: getGeneratorState(),
    vehicleRecords: vehicles,
    totalVehicles: Object.values(trafficState).reduce((total, road) => total + road.totalVehicles, 0),
    averageWaitingTime: Object.values(trafficState).length ? Math.round(Object.values(trafficState).reduce((total, road) => total + road.waitingTime, 0) / Object.values(trafficState).length) : 0,
  }), [applyVideoAnalysis, backendStatus, config, databaseStatus, emergencyState, isRunning, mode, pedestrianState, scenario, sensorEvents, sensorState, signalState, simulationSeed, simulationTime, starvationState, syncManualTraffic, trafficState, vehicles, videoServiceStatus]);

  return <TrafficContext.Provider value={value}>{children}</TrafficContext.Provider>;
}

export function useTraffic() {
  const context = useContext(TrafficContext);
  if (!context) throw new Error('useTraffic must be used inside TrafficProvider');
  return context;
}
