import { CheckCircle2 } from 'lucide-react';
import { PageIntro, SectionHeading, StatusBadge, Timeline } from '../components/Shared';
import { useTraffic } from '../context/TrafficContext';
import { calculatePhasePriority, SIGNAL_PHASES } from '../algorithms/adaptiveSignalController';

function phaseLabel(phase) { return phase === 'ns' ? 'NORTH-SOUTH' : 'EAST-WEST'; }
function phaseDirections(phase) { return phase === 'ns' ? 'North and South approaches' : 'East and West approaches'; }

function signalTone(state) {
  if (state === 'GREEN') return 'green';
  if (state === 'YELLOW') return 'amber';
  return 'coral';
}

function roadState(signalState, road) {
  const isActivePhase =
    (signalState.phase === 'ns' && (road === 'north' || road === 'south')) ||
    (signalState.phase === 'ew' && (road === 'east' || road === 'west'));
  if (signalState.state === 'ALL RED') return 'RED';
  if (isActivePhase) return signalState.state;
  return 'RED';
}

function roadTone(state) {
  if (state === 'GREEN') return 'green';
  if (state === 'YELLOW') return 'amber';
  return 'coral';
}

function roadLightClass(state) {
  if (state === 'GREEN') return 'green';
  if (state === 'YELLOW') return 'yellow';
  return 'red';
}

export default function SignalControl() {
  const { signalState, trafficState, starvationState, config, totalVehicles } = useTraffic();
  const nsPriority = calculatePhasePriority(trafficState, SIGNAL_PHASES.NS, config.priorityWeights, starvationState, config.starvation);
  const ewPriority = calculatePhasePriority(trafficState, SIGNAL_PHASES.EW, config.priorityWeights, starvationState, config.starvation);

  return <div className="page"><PageIntro eyebrow="Control layer" title="Signal control" description="Review the active adaptive phase plan and timing boundaries for Junction A-01." action={<StatusBadge tone={signalTone(signalState.state)}>{signalState.state}</StatusBadge>} /><div className="two-column-layout"><section className="panel"><SectionHeading title="Current phase" detail={`${phaseLabel(signalState.phase)} · ${totalVehicles} vehicles observed`} /><div className="control-phase"><div className={`large-signal ${signalTone(signalState.state)}`}><i /><i /><i className="lit" /></div><div><span className="eyebrow">Active signal</span><h2>{signalState.state}</h2><p>{phaseDirections(signalState.phase)} have right of way.</p></div><div className="control-count"><span>Remaining</span><strong>{signalState.remaining}<small>sec</small></strong></div></div><div className="control-fields"><div><span>Requested green</span><strong>{signalState.requestedGreen} sec</strong></div><div><span>Approved green</span><strong>{signalState.approvedGreen} sec</strong></div><div><span>Yellow time</span><strong>{config.signalTiming.yellow} sec</strong></div><div><span>All-red time</span><strong>{config.signalTiming.allRed} sec</strong></div><div><span>NS priority</span><strong>{nsPriority.toFixed(1)}</strong></div><div><span>EW priority</span><strong>{ewPriority.toFixed(1)}</strong></div></div></section><section className="panel safety-mini"><SectionHeading title="Signal states" detail="Adaptive phase display" /><div className="state-list">{['north', 'south', 'east', 'west'].map(road => { const state = roadState(signalState, road); return <div key={road}><span className={`state-light ${roadLightClass(state)}`} />{road[0].toUpperCase() + road.slice(1)} <StatusBadge tone={roadTone(state)}>{state}</StatusBadge></div>; })}</div><div className="validation-note"><CheckCircle2 size={16} /> {signalState.reason} · Safe phase timing</div></section></div><section className="panel"><SectionHeading title="Adaptive decision" detail="Priority-based phase selection" /><div className="control-fields"><div><span>Selected phase</span><strong>{phaseLabel(signalState.phase)}</strong></div><div><span>Current priority</span><strong>{signalState.currentPriority.toFixed(1)}</strong></div><div><span>NS priority score</span><strong>{nsPriority.toFixed(1)}</strong></div><div><span>EW priority score</span><strong>{ewPriority.toFixed(1)}</strong></div><div><span>Requested green</span><strong>{signalState.requestedGreen} sec</strong></div><div><span>Approved green</span><strong>{signalState.approvedGreen} sec</strong></div><div><span>Remaining</span><strong>{signalState.remaining} sec</strong></div><div><span>Traffic reason</span><strong>{signalState.reason}</strong></div></div></section><section className="panel timeline-panel"><SectionHeading title="Signal timeline" detail={`GREEN → YELLOW → ALL RED → NEXT GREEN · ${config.signalTiming.yellow}s / ${config.signalTiming.allRed}s`} /><Timeline /><div className="timeline-caption"><span>Traffic reason</span><strong>{signalState.reason}</strong><span>Remaining {signalState.remaining} sec</span></div></section></div>;
}
