import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import routes from './routes.js';

function isLocalOrigin(origin = '') {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function getAllowedOrigins() {
  const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const clientUrl = String(process.env.CLIENT_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const publicSiteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const renderExternalUrl = String(process.env.RENDER_EXTERNAL_URL || '')
    .trim()
    .replace(/\/+$/, '');

  const defaults = [
    clientUrl,
    publicSiteUrl,
    renderExternalUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
  ].filter(Boolean);

  return [...new Set([...configuredOrigins, ...defaults])];
}

export function createExpressApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = getAllowedOrigins();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cookieParser());

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }

        const normalizedOrigin = origin.replace(/\/+$/, '');

        if (!isProduction && isLocalOrigin(normalizedOrigin)) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }

        return callback(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
      },
      credentials: true,
    })
  );

  // Stripe webhook raw body must stay before express.json()
  app.use('/payments/webhook', express.raw({ type: 'application/json' }));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.use(routes);

  app.get('/', (req, res) => {
    res.send('Restful service');
  });

  return app;
}
