export const formatMetric = (value, suffix = '') => `${value}${suffix}`;

export const loadSettings = (defaults) => {
  try {
    const stored = localStorage.getItem('traffic-settings');
    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  } catch {
    return defaults;
  }
};
