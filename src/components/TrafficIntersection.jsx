import { CarFront } from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';

function roadSignalState(signalState, road) {
  const phase = signalState.phase;
  const state = signalState.state;
  const isActivePhase =
    (phase === 'ns' && (road === 'north' || road === 'south')) ||
    (phase === 'ew' && (road === 'east' || road === 'west'));

  if (state === 'ALL RED') return 'red';
  if (state === 'WALK') return 'red';
  if (isActivePhase) {
    if (state === 'GREEN') return 'green';
    if (state === 'YELLOW') return 'yellow';
  }
  return 'red';
}

function Signal({ position, direction, state }) {
  return (
    <div className={`intersection-signal ${position}`}>
      <span className="signal-label">{direction}</span>
      <div className="signal-stack">
        <span className={`signal-light red-light ${state === 'red' ? 'lit' : ''}`} />
        <span className={`signal-light yellow-light ${state === 'yellow' ? 'lit' : ''}`} />
        <span className={`signal-light green-light ${state === 'green' ? 'lit' : ''}`} />
      </div>
    </div>
  );
}

export default function TrafficIntersection({ emergency }) {
  const { signalState, isRunning } = useTraffic();
  const emergencyVehicle = emergency?.active || emergency?.queue?.[0];

  const signals = [
    { position: 'north-signal', direction: 'N', state: roadSignalState(signalState, 'north') },
    { position: 'south-signal', direction: 'S', state: roadSignalState(signalState, 'south') },
    { position: 'east-signal', direction: 'E', state: roadSignalState(signalState, 'east') },
    { position: 'west-signal', direction: 'W', state: roadSignalState(signalState, 'west') },
  ];

  return (
    <div className="intersection-wrap">
      <div className="intersection-meta">
        <span><span className="legend-swatch road-swatch" />Live intersection view</span>
        <span><span className="legend-swatch vehicle-swatch" />Vehicle placeholder</span>
      </div>
      <div className="intersection">
        {emergencyVehicle && (
          <div className={`emergency-ambulance emergency-${emergencyVehicle.road}`}>
            <span className="emergency-light" />
            <span className="emergency-light" />
            <strong>🚑</strong>
          </div>
        )}
        <div className="road road-horizontal">
          <div className="lane-line lane-one" />
          <div className="lane-line lane-two" />
          <div className="crossing crossing-left" />
          <div className="crossing crossing-right" />
          <div className="stop-line stop-left" />
          <div className="stop-line stop-right" />
          <div className="vehicle vehicle-east"><CarFront size={16} /></div>
          <div className="vehicle vehicle-west"><CarFront size={16} /></div>
        </div>
        <div className="road road-vertical">
          <div className="lane-line lane-three" />
          <div className="lane-line lane-four" />
          <div className="crossing crossing-top" />
          <div className="crossing crossing-bottom" />
          <div className="stop-line stop-top" />
          <div className="stop-line stop-bottom" />
          <div className="vehicle vehicle-north"><CarFront size={16} /></div>
          <div className="vehicle vehicle-south"><CarFront size={16} /></div>
        </div>
        <div className="intersection-core">
          <span className="core-label">Junction A-01</span>
          <span className="core-sub">4-way control zone</span>
        </div>
        {signals.map((signal) => <Signal key={signal.position} {...signal} />)}
        <span className="direction north-label">NORTH</span>
        <span className="direction south-label">SOUTH</span>
        <span className="direction east-label">EAST</span>
        <span className="direction west-label">WEST</span>
      </div>
      <div className="intersection-footer">
        <span><b className="online-dot" />{isRunning ? 'Simulation running' : 'Simulation ready'}</span>
        <span>{emergencyVehicle ? '🚑 EMERGENCY VEHICLE APPROACHING' : isRunning ? 'Vehicle flow active' : 'Vehicle flow paused'}</span>
      </div>
    </div>
  );
}
