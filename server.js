import dotenv from 'dotenv';
import next from 'next';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from './server/mongoose.js';
import { createUnifiedRoutingApp } from './server/unifiedRouting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV =
    process.env.npm_lifecycle_event === 'start' ? 'production' : 'development';
}

const isTest = process.env.NODE_ENV === 'test';
const envCandidates = isTest
  ? [path.resolve(__dirname, '.env.test')]
  : [
      path.resolve(__dirname, '.env'),
      path.resolve(__dirname, 'server/.env'),
      path.resolve(__dirname, '../Happy-Colors-SECRETS/.env'),
    ];

const envPath = envCandidates.find((candidatePath) => fs.existsSync(candidatePath));

if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`✅ ENV loaded from: ${envPath}`);
} else if (isTest) {
  console.warn('No .env.test file found. Using environment variables only.');
} else {
  dotenv.config();
  console.warn('⚠️ No .env file found. Using environment variables.');
}

const dev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT) || 3000;
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

const { createExpressApp } = await import('./server/server.js');
const expressApp = createExpressApp();

const nextApp = next({
  dev,
  dir: path.resolve(__dirname, 'happy-colors-nextjs-project'),
});

await nextApp.prepare();

const nextHandler = nextApp.getRequestHandler();
const app = createUnifiedRoutingApp({ expressApp, nextHandler });

app.listen(PORT, () => {
  console.log(`✅ Unified server listening on port ${PORT}`);
});
