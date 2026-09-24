import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    isConnected = false;
    console.warn('[DB] MONGODB_URI not set — running without database.');
    return false;
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    isConnected = false;
    console.warn('[DB] Invalid MongoDB URI format. Expected mongodb:// or mongodb+srv://');
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      autoIndex: true,
      retryWrites: true,
    });
    isConnected = true;
    console.log('[DB] MongoDB connected successfully.');
    return true;
  } catch (err) {
    isConnected = false;
    const rawMessage = err instanceof Error ? err.message : String(err);
    const sanitizedMessage = rawMessage
      .replace(/(mongodb(?:\+srv)?:\/\/)([^:]+)(:[^@]+)(@)/i, '$1$2:***$4')
      .replace(/(password=)([^&\s]+)/gi, '$1***')
      .replace(/(pass=)([^&\s]+)/gi, '$1***');

    console.warn('[DB] MongoDB connection failed.');
    console.warn(`[DB] Cause: ${sanitizedMessage}`);
    console.warn('[DB] Ensure your Atlas username/password and IP whitelist are valid.');
    return false;
  }
}

mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('[DB] MongoDB connected.');
});

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
