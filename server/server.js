import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import routes from './routes.js';

function isLocalOrigin(origin = '') {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function getAllowedOrigins() {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const clientUrl = String(process.env.CLIENT_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const trustedClientUrl = isProduction && isLocalOrigin(clientUrl) ? '' : clientUrl;
  const allowsLocalDefaultOrigins =
    ['development', 'test'].includes(process.env.NODE_ENV) || (!process.env.NODE_ENV && isLocalOrigin(clientUrl));
  const publicSiteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const newsletterPublicSiteUrl = String(process.env.NEWSLETTER_PUBLIC_SITE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const renderExternalUrl = String(process.env.RENDER_EXTERNAL_URL || '')
    .trim()
    .replace(/\/+$/, '');

  const defaults = [
    trustedClientUrl,
    publicSiteUrl,
    newsletterPublicSiteUrl,
    renderExternalUrl,
    ...(allowsLocalDefaultOrigins
      ? [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
          'http://localhost:3002',
          'http://127.0.0.1:3002',
        ]
      : []),
  ].filter(Boolean);

  return [...new Set([...configuredOrigins, ...defaults])];
}

export function createExpressApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  const allowsLocalCorsOrigins =
    ['development', 'test'].includes(process.env.NODE_ENV) ||
    (!process.env.NODE_ENV && allowedOrigins.some(isLocalOrigin));

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

        if (allowsLocalCorsOrigins && isLocalOrigin(normalizedOrigin)) {
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

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '100kb' }));

  app.use(routes);

  app.get('/', (req, res) => {
    res.send('Restful service');
  });

  return app;
}
