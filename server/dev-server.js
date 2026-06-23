import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import mongoose from './mongoose.js';
import { createExpressApp } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const envCandidates = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../Happy-Colors-SECRETS/.env'),
];

const envPath = envCandidates.find((candidatePath) => fs.existsSync(candidatePath));

if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`✅ ENV loaded from: ${envPath}`);
} else {
  dotenv.config();
  console.warn('⚠️ No .env file found. Using environment variables.');
}

const PORT = Number(process.env.PORT) || 3030;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing.');
  process.exit(1);
}

mongoose.set('strictQuery', true);

try {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas');
} catch (error) {
  console.error('❌ Error connecting to MongoDB:', error.message);
  process.exit(1);
}

const app = createExpressApp();

app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
