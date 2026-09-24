import { ArrowUpRight, CheckCircle2, CircleAlert, Clock3, Radio, ShieldCheck, Siren, UsersRound } from 'lucide-react';
import { AreaChart, Area, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function PageIntro({ eyebrow, title, description, action }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function SectionHeading({ title, detail, action }) {
  return <div className="section-heading"><div><h2>{title}</h2>{detail && <span>{detail}</span>}</div>{action}</div>;
}

export function StatusBadge({ children, tone = 'green' }) { return <span className={`status-badge ${tone}`}><span className="badge-dot" />{children}</span>; }

export function MetricCard({ label, value, unit, trend, icon: Icon, tone = 'green' }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`}><Icon size={17} /></div></div><div className="metric-value">{value}<small>{unit}</small></div>{trend && <div className="metric-trend"><ArrowUpRight size={14} />{trend}</div>}</div>;
}

export function TrafficCard({ data }) {
  return <article className="traffic-card"><div className="traffic-card-head"><div className="direction-icon">{data.short}</div><div><h3>{data.direction}</h3><span>Approach lane</span></div><StatusBadge tone={data.tone}>{data.status}</StatusBadge></div><div className="traffic-stat-grid"><div><span>Vehicles</span><strong>{data.vehicles}</strong></div><div><span>Density</span><strong>{data.density}</strong></div><div><span>Queue</span><strong>{data.queue}</strong></div><div><span>Waiting</span><strong>{data.waiting}<small> sec</small></strong></div></div></article>;
}

const chartConfig = {
  density: { dataKey: 'east', color: '#e1a22a', label: 'Density', data: [] },
  queue: { dataKey: 'queue', color: '#2f8077', label: 'Queue', data: [] },
  waiting: { dataKey: 'waiting', color: '#de6d4b', label: 'Waiting', data: [] },
};

export function TrendChart({ type, data }) {
  const config = { ...chartConfig[type], data };
  const Chart = type === 'density' ? AreaChart : LineChart;
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><Chart data={config.data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
    <CartesianGrid stroke="#e8ebe6" strokeDasharray="3 4" vertical={false} />
    <XAxis dataKey="time" tick={{ fill: '#88918d', fontSize: 10 }} tickLine={false} axisLine={false} />
    <YAxis tick={{ fill: '#88918d', fontSize: 10 }} tickLine={false} axisLine={false} />
    <Tooltip contentStyle={{ border: '1px solid #e1e7e0', borderRadius: 8, fontSize: 12, boxShadow: '0 8px 24px rgba(35, 53, 46, .08)' }} />
    {type === 'density' ? <Area type="monotone" dataKey={config.dataKey} stroke={config.color} fill="#f9e8bd" fillOpacity={0.55} strokeWidth={2.5} /> : <Line type="monotone" dataKey={config.dataKey} stroke={config.color} strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: config.color }} />}
  </Chart></ResponsiveContainer></div>;
}

export function EmptyState({ icon: Icon = Radio, title, body }) { return <div className="empty-state"><div className="empty-icon"><Icon size={21} /></div><h3>{title}</h3><p>{body}</p></div>; }

export function SafetyPanel() {
  return <div className="safety-panel"><div className="safety-visual"><div className="safe-ring"><ShieldCheck size={28} /></div><div><div className="eyebrow">Safety monitor</div><h3>All systems safe</h3><p>Signal transitions are being validated.</p></div><StatusBadge tone="green">SAFE</StatusBadge></div><div className="safety-stats"><div><strong>0</strong><span>Conflicting signals</span></div><div><strong>0</strong><span>Blocked transitions</span></div><div><strong>0</strong><span>Safety events</span></div></div></div>;
}

export function Timeline() {
  return <div className="signal-timeline"><div className="timeline-line" /><div className="timeline-step current"><div className="timeline-dot green-dot" /><strong>GREEN</strong><span>Current phase</span></div><div className="timeline-step"><div className="timeline-dot yellow-dot" /><strong>YELLOW</strong><span>3 seconds</span></div><div className="timeline-step"><div className="timeline-dot red-dot" /><strong>ALL RED</strong><span>2 seconds</span></div><div className="timeline-step"><div className="timeline-dot hollow-dot" /><strong>NEXT GREEN</strong><span>East-West</span></div></div>;
}

export function EventLog({ events }) {
  return <div className="event-log">{events.map(([time, text, tone]) => <div className="event-row" key={time}><span className="event-time">{time}</span><span className={`event-marker ${tone}`} /><span>{text}</span></div>)}</div>;
}

export const panelIcons = { emergency: Siren, pedestrian: UsersRound, clock: Clock3, safe: CheckCircle2, alert: CircleAlert };
