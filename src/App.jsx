import { Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import TrafficAnalysis from './pages/TrafficAnalysis';
import SignalControl from './pages/SignalControl';
import EmergencyManagement from './pages/EmergencyManagement';
import PedestrianManagement from './pages/PedestrianManagement';
import PerformanceComparison from './pages/PerformanceComparison';
import Settings from './pages/Settings';

export default function App() {
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<Dashboard />} /><Route path="/traffic-analysis" element={<TrafficAnalysis />} /><Route path="/signal-control" element={<SignalControl />} /><Route path="/emergency" element={<EmergencyManagement />} /><Route path="/pedestrian" element={<PedestrianManagement />} /><Route path="/performance" element={<PerformanceComparison />} /><Route path="/settings" element={<Settings />} /></Route></Routes>;
}
