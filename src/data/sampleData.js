export const trafficCards = [
  { direction: 'North', short: 'N', vehicles: 0, density: '0.0', queue: 0, waiting: 0, status: 'LOW', tone: 'green' },
  { direction: 'South', short: 'S', vehicles: 0, density: '0.0', queue: 0, waiting: 0, status: 'LOW', tone: 'green' },
  { direction: 'East', short: 'E', vehicles: 0, density: '0.0', queue: 0, waiting: 0, status: 'LOW', tone: 'green' },
  { direction: 'West', short: 'W', vehicles: 0, density: '0.0', queue: 0, waiting: 0, status: 'LOW', tone: 'green' },
];

export const densityData = [
  { time: '10:00', north: 18, south: 12, east: 28, west: 24 },
  { time: '10:05', north: 24, south: 18, east: 34, west: 29 },
  { time: '10:10', north: 20, south: 21, east: 40, west: 33 },
  { time: '10:15', north: 31, south: 24, east: 36, west: 38 },
  { time: '10:20', north: 28, south: 20, east: 29, west: 34 },
  { time: '10:25', north: 22, south: 17, east: 25, west: 27 },
];

export const queueData = densityData.map((item) => ({ time: item.time, queue: Math.round((item.north + item.south + item.east + item.west) / 12) }));
export const waitingData = densityData.map((item, index) => ({ time: item.time, waiting: [18, 21, 24, 22, 19, 16][index] }));

export const eventLog = [
  ['10:31:10', 'Traffic simulation waiting for input.', 'muted'],
  ['10:31:08', 'Safety layer initialized.', 'safe'],
  ['10:31:05', 'Adaptive controller ready.', 'accent'],
  ['10:31:02', 'System initialized.', 'accent'],
];
