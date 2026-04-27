import mongoose from 'mongoose';
import { ensureServerEnvLoaded } from './env';

mongoose.set('strictQuery', true);

let connectionPromise = null;

export async function connectToMongo() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise) {
    ensureServerEnvLoaded();
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI is not configured.');
    }

    connectionPromise = mongoose.connect(mongoUri);
  }

  await connectionPromise;

  return mongoose;
}
