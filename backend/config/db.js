import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[DB] MONGODB_URI not set — running without database.');
    return false;
  }
  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('[DB] MongoDB connected successfully.');
    return true;
  } catch (err) {
    isConnected = false;
    console.error('[DB] MongoDB connection failed:', err.message);
    return false;
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[DB] MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[DB] MongoDB reconnected.');
});

export function getConnectionStatus() {
  return {
    connected: isConnected,
    readyState: mongoose.connection.readyState,
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  };
}
