import { Camera, ChevronRight, FileDigit, Pause, Play, RotateCcw, Upload, Video, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState, PageIntro, SectionHeading, StatusBadge, TrafficCard } from '../components/Shared';
import { ROAD_NAMES, VEHICLE_LABELS, VEHICLE_TYPES } from '../data/trafficConfig';
import { useTraffic } from '../context/TrafficContext';
import {
  analyzeVideo,
  checkModelAvailability,
  createManualEstimation,
  createVideoPreview,
  revokeVideoPreview,
  SERVICE_STATUS,
  DETECTION_SOURCE,
  isModelAvailable,
} from '../services/VehicleDetectionService';

const sources = [
  { id: 'simulation', icon: Play, title: 'Simulation', tag: 'Working', body: 'Generate a controlled traffic stream with configurable vehicle mixes and demand patterns.', action: 'Use simulation', tone: 'green' },
  { id: 'manual', icon: FileDigit, title: 'Manual input', tag: 'Working', body: 'Enter vehicle counts by approach to test traffic density with a known traffic snapshot.', action: 'Use manual input', tone: 'amber' },
  { id: 'video', icon: Video, title: 'Video analysis', tag: 'Working', body: 'Upload road video for camera-based traffic density and queue estimation.', action: 'Use video analysis', tone: 'green' },
];

function ManualInputs({ trafficState, updateManualCount }) {
  return <div className="manual-input-grid">{Object.entries(ROAD_NAMES).map(([road, name]) => <article className="manual-road-card" key={road}>
    <div className="manual-road-heading"><h3>{name}</h3><StatusBadge tone={trafficState[road].status === 'RUSH' ? 'coral' : trafficState[road].status === 'LOW' ? 'green' : 'amber'}>{trafficState[road].status}</StatusBadge></div>
    <div className="manual-fields">{VEHICLE_TYPES.map(type => <label key={type}><span>{VEHICLE_LABELS[type]}</span><input type="number" min="0" step="1" value={trafficState[road].vehicles[type]} onChange={event => updateManualCount(road, type, event.target.value)} /></label>)}</div>
    <div className="manual-result"><span>{trafficState[road].totalVehicles} vehicles</span><strong>{trafficState[road].density.toFixed(1)} density</strong><span>Queue {trafficState[road].queueLength} · Wait {trafficState[road].waitingTime}s</span></div>
  </article>)}</div>;
}

function SimulationControls({ scenario, setScenario, isRunning, startSimulation, pauseSimulation, resetTraffic }) {
  return <div className="simulation-controls"><div className="button-row"><button className="primary-button" onClick={startSimulation} disabled={isRunning}><Play size={14} /> START</button><button className="secondary-button" onClick={pauseSimulation} disabled={!isRunning}><Pause size={14} /> PAUSE</button><button className="secondary-button" onClick={resetTraffic}><RotateCcw size={14} /> RESET</button></div><div className="scenario-controls"><span>Scenario</span>{Object.entries({ offpeak: 'OFF-PEAK', normal: 'NORMAL', rush: 'RUSH HOUR' }).map(([key, label]) => <button key={key} className={scenario === key ? 'selected' : ''} onClick={() => setScenario(key)}>{label}</button>)}</div></div>;
}

function VideoAnalysisPanel({ trafficState, applyVideoAnalysis }) {
  const [selectedRoad, setSelectedRoad] = useState('east');
  const [videoFile, setVideoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState(SERVICE_STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [manualCounts, setManualCounts] = useState({ cycle: 0, bike: 0, auto: 0, car: 0, heavy: 0 });
  const [analysisResult, setAnalysisResult] = useState(null);
  const [applied, setApplied] = useState(false);
  const fileInputRef = useRef(null);

  // Check model availability on mount and when panel becomes visible
  useEffect(() => {
    checkModelAvailability();
  }, []);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => revokeVideoPreview(previewUrl);
  }, [previewUrl]);

  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clean up previous
    revokeVideoPreview(previewUrl);
    setAnalysisResult(null);
    setApplied(false);
    setStatusMessage('');

    setVideoFile(file);
    setPreviewUrl(createVideoPreview(file));
    setStatus(SERVICE_STATUS.ANALYZING);
    setStatusMessage('Uploading and analyzing video... This may take a moment.');

    // Refresh model status before analyzing
    await checkModelAvailability();

    const result = await analyzeVideo(file, selectedRoad);
    setStatus(result.status);

    if (result.status === SERVICE_STATUS.COMPLETE && result.result) {
      setAnalysisResult(result.result);
      if (result.result.source === DETECTION_SOURCE.MODEL) {
        setStatusMessage(`YOLO detection complete — ${result.result.totalVehicles} vehicles detected in ${result.result.framesProcessed} frames (${result.result.processingTime}s).`);
      } else {
        setStatusMessage('Analysis complete — vehicle detection model results.');
      }
      setManualCounts(result.result.vehicles);
    } else if (result.status === SERVICE_STATUS.MODEL_UNAVAILABLE) {
      setStatusMessage(result.message);
    } else if (result.status === SERVICE_STATUS.ERROR) {
      setStatusMessage(result.error);
    }
  }, [previewUrl, selectedRoad]);

  const handleManualEstimate = useCallback(() => {
    const estimation = createManualEstimation(manualCounts);
    setAnalysisResult(estimation);
    setStatusMessage(`Manual estimation applied for ${ROAD_NAMES[selectedRoad]} camera — ${estimation.totalVehicles} vehicles counted.`);
    setStatus(SERVICE_STATUS.COMPLETE);
    setApplied(false);
  }, [manualCounts, selectedRoad]);

  const handleApplyToTraffic = useCallback(() => {
    if (!analysisResult) return;
    applyVideoAnalysis(selectedRoad, analysisResult.vehicles);
    setApplied(true);
    setStatusMessage(`Traffic data applied to ${ROAD_NAMES[selectedRoad]} — adaptive controller updated.`);
  }, [analysisResult, applyVideoAnalysis, selectedRoad]);

  const handleReset = useCallback(() => {
    revokeVideoPreview(previewUrl);
    setVideoFile(null);
    setPreviewUrl(null);
    setStatus(SERVICE_STATUS.IDLE);
    setStatusMessage('');
    setManualCounts({ cycle: 0, bike: 0, auto: 0, car: 0, heavy: 0 });
    setAnalysisResult(null);
    setApplied(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    checkModelAvailability();
  }, [previewUrl]);

  const modelAvailable = isModelAvailable();

  return (
    <div className="video-analysis-container">
      {/* Camera / Road Selection */}
      <div className="video-camera-selector">
        <SectionHeading title="Camera selection" detail="Associate this video with a road approach" />
        <div className="camera-buttons">
          {Object.entries(ROAD_NAMES).map(([road, name]) => (
            <button
              key={road}
              className={`camera-button ${selectedRoad === road ? 'selected' : ''}`}
              onClick={() => { setSelectedRoad(road); setApplied(false); }}
            >
              <Camera size={16} />
              {name} camera
            </button>
          ))}
        </div>
      </div>

      {/* Upload */}
      <div className="video-upload-section">
        <SectionHeading title="Upload traffic video" detail="MP4, WebM, MOV · Max 500 MB" />
        <div className="upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={handleFileSelect}
            className="file-input"
            id="video-upload"
          />
          <label htmlFor="video-upload" className="upload-label">
            <Upload size={28} />
            <span>{videoFile ? videoFile.name : 'Click to select a traffic video'}</span>
            {videoFile && <small>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</small>}
          </label>
        </div>
      </div>

      {/* Video Preview */}
      {previewUrl && (
        <div className="video-preview-section">
          <SectionHeading title="Video preview" detail={`${ROAD_NAMES[selectedRoad]} camera · ${videoFile?.name}`} />
          <video
            src={previewUrl}
            controls
            className="video-preview"
            style={{ width: '100%', maxHeight: '360px', borderRadius: '8px', background: '#000' }}
          />
        </div>
      )}

      {/* Status */}
      {statusMessage && (
        <div className={`video-status ${status === SERVICE_STATUS.ERROR ? 'error' : status === SERVICE_STATUS.MODEL_UNAVAILABLE ? 'warning' : status === SERVICE_STATUS.ANALYZING ? 'info' : status === SERVICE_STATUS.COMPLETE ? 'success' : 'info'}`}>
          {status === SERVICE_STATUS.ERROR && <AlertTriangle size={16} />}
          {status === SERVICE_STATUS.MODEL_UNAVAILABLE && <AlertTriangle size={16} />}
          {status === SERVICE_STATUS.ANALYZING && <span className="analyzing-spinner">⏳</span>}
          {status === SERVICE_STATUS.COMPLETE && <CheckCircle2 size={16} />}
          <span>{statusMessage}</span>
          {analysisResult && <StatusBadge tone={analysisResult.source === DETECTION_SOURCE.MODEL ? 'green' : 'amber'}>
            {analysisResult.source === DETECTION_SOURCE.MODEL ? 'REAL MODEL DETECTION ✓' : 'MANUAL ESTIMATION'}
          </StatusBadge>}
        </div>
      )}

      {/* Model Status Banner */}
      {videoFile && !modelAvailable && status !== SERVICE_STATUS.ANALYZING && (
        <div className="video-model-banner">
          <AlertTriangle size={16} />
          <div>
            <strong>Vehicle detection model is not connected</strong>
            <span>A Python/OpenCV/YOLO backend is required for automatic detection. Use manual estimation below.</span>
          </div>
        </div>
      )}

      {/* Manual Estimation Inputs */}
      {videoFile && !modelAvailable && (
        <div className="video-manual-estimation">
          <SectionHeading title="Manual estimation" detail={`Enter observed vehicle counts for ${ROAD_NAMES[selectedRoad]} camera`} />
          <div className="manual-fields">
            {VEHICLE_TYPES.map(type => (
              <label key={type}>
                <span>{VEHICLE_LABELS[type]}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={manualCounts[type]}
                  onChange={e => setManualCounts(prev => ({ ...prev, [type]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="button-row" style={{ marginTop: '0.75rem' }}>
            <button className="primary-button" onClick={handleManualEstimate}>
              <CheckCircle2 size={14} /> ESTIMATE
            </button>
            <button className="secondary-button" onClick={handleReset}>
              <RotateCcw size={14} /> RESET
            </button>
          </div>
        </div>
      )}

      {/* Analysis Result */}
      {analysisResult && (
        <div className="video-analysis-result">
          <SectionHeading title="Analysis result" detail={`${ROAD_NAMES[selectedRoad]} camera`} action={
            <StatusBadge tone={analysisResult.source === DETECTION_SOURCE.MODEL ? 'green' : 'amber'}>
              {analysisResult.source === DETECTION_SOURCE.MODEL ? 'REAL MODEL DETECTION' : 'SIMULATED / MANUAL ESTIMATION'}
            </StatusBadge>
          } />
          <div className="result-grid">
            <div className="result-item highlight"><span>Total vehicles</span><strong>{analysisResult.totalVehicles}</strong></div>
            <div className="result-item"><span>Cars</span><strong>{analysisResult.vehicles.car}</strong></div>
            <div className="result-item"><span>Bikes</span><strong>{analysisResult.vehicles.bike}</strong></div>
            <div className="result-item"><span>Autos</span><strong>{analysisResult.vehicles.auto}</strong></div>
            <div className="result-item"><span>Heavy vehicles</span><strong>{analysisResult.vehicles.heavy}</strong></div>
            <div className="result-item"><span>Cycles</span><strong>{analysisResult.vehicles.cycle}</strong></div>
          </div>
          {/* Real YOLO detection metrics */}
          {analysisResult.source === DETECTION_SOURCE.MODEL && (
            <div className="result-grid" style={{ marginTop: '0.75rem' }}>
              <div className="result-item"><span>Weighted density</span><strong>{analysisResult.density}</strong></div>
              <div className="result-item"><span>Traffic status</span><strong>{analysisResult.trafficStatus}</strong></div>
              <div className="result-item"><span>Queue estimate</span><strong>{analysisResult.queueLength}</strong></div>
              <div className="result-item"><span>Detection confidence</span><strong>{(analysisResult.confidence * 100).toFixed(1)}%</strong></div>
              <div className="result-item"><span>Frames processed</span><strong>{analysisResult.framesProcessed}</strong></div>
              <div className="result-item"><span>Processing time</span><strong>{analysisResult.processingTime}s</strong></div>
            </div>
          )}
          {/* Show current road state after apply */}
          {applied && trafficState[selectedRoad] && (
            <div className="result-grid" style={{ marginTop: '0.75rem' }}>
              <div className="result-item"><span>Density</span><strong>{trafficState[selectedRoad].density.toFixed(1)}</strong></div>
              <div className="result-item"><span>Traffic</span><strong>{trafficState[selectedRoad].status}</strong></div>
              <div className="result-item"><span>Queue</span><strong>{trafficState[selectedRoad].queueLength}</strong></div>
            </div>
          )}
          {/* Class mapping note for real detection */}
          {analysisResult.classMapping && (
            <div className="video-model-banner" style={{ marginTop: '0.75rem' }}>
              <AlertTriangle size={14} />
              <div>
                <strong>Detection class notes</strong>
                <span>Directly detected: {analysisResult.classMapping.directlyDetected.join(', ')}</span>
                {analysisResult.classMapping.notDetected && <span style={{ display: 'block', marginTop: '2px' }}>Not detected: {analysisResult.classMapping.notDetected.join(', ')}</span>}
              </div>
            </div>
          )}
          <div className="button-row" style={{ marginTop: '1rem' }}>
            <button className="primary-button" onClick={handleApplyToTraffic} disabled={applied}>
              {applied ? '✓ APPLIED TO ADAPTIVE CONTROLLER' : 'APPLY TO TRAFFIC STATE'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrafficAnalysis() {
  const { trafficState, scenario, setScenario, isRunning, startSimulation, pauseSimulation, resetTraffic, updateManualCount, setMode, mode, applyVideoAnalysis } = useTraffic();
  const activeSource = mode === 'manual' ? 'manual' : mode === 'video' ? 'video' : 'simulation';
  return <div className="page"><PageIntro eyebrow="Input layer" title="Traffic analysis" description="Choose how traffic demand enters the control system. Simulation, manual input, and video analysis are available." /><section className="panel source-panel"><SectionHeading title="Select a traffic source" detail="One source can be active per session" /><div className="source-grid">{sources.map(({ id, icon: Icon, title, tag, body, action, tone }) => <article className={`source-card ${tone} ${activeSource === id ? 'source-active' : ''}`} key={id}><div className="source-card-top"><div className="source-icon"><Icon size={21} /></div><span className="source-tag">{tag}</span></div><h3>{title}</h3><p>{body}</p><button className="secondary-button" onClick={() => setMode(id)}>{action}<ChevronRight size={15} /></button></article>)}</div></section>
    {activeSource === 'simulation' && <section className="panel analysis-workspace"><SectionHeading title="Simulation controls" detail={isRunning ? 'Simulation running' : 'Simulation paused'} action={<StatusBadge tone={isRunning ? 'green' : 'muted'}>{isRunning ? 'LIVE' : 'PAUSED'}</StatusBadge>} /><SimulationControls scenario={scenario} setScenario={setScenario} isRunning={isRunning} startSimulation={startSimulation} pauseSimulation={pauseSimulation} resetTraffic={resetTraffic} /></section>}
    {activeSource === 'manual' && <section className="panel analysis-workspace"><SectionHeading title="Manual traffic input" detail="Empty and negative values are normalized safely" /><ManualInputs trafficState={trafficState} updateManualCount={updateManualCount} /></section>}
    {activeSource === 'video' && <section className="panel analysis-workspace"><VideoAnalysisPanel trafficState={trafficState} applyVideoAnalysis={applyVideoAnalysis} /></section>}
    {(activeSource === 'simulation' || activeSource === 'manual' || activeSource === 'video') && <section className="panel analysis-workspace"><SectionHeading title="Current traffic state" detail="Shared with Dashboard and adaptive controller" /><div className="analysis-road-summary">{Object.entries(ROAD_NAMES).map(([road, name]) => <div key={road}><strong>{name}</strong><span>{trafficState[road].totalVehicles} vehicles</span><span>{trafficState[road].density.toFixed(1)} density</span><span>{trafficState[road].status}</span><span>Queue {trafficState[road].queueLength}</span></div>)}</div></section>}
  </div>;
}
