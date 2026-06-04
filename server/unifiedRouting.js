import express from 'express';

import { isApiPath, isBackendApiPath } from './apiRouteOwnership.js';

function getOriginalRequestUrl(req) {
  return req.originalUrl || req.url || '';
}

export function createUnifiedRoutingApp({ expressApp, nextHandler }) {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, nextMiddleware) => {
    const requestUrl = getOriginalRequestUrl(req);

    if (isApiPath(requestUrl) && !isBackendApiPath(requestUrl)) {
      return nextHandler(req, res);
    }

    return nextMiddleware();
  });

  app.use('/api', (req, res, nextMiddleware) => {
    expressApp(req, res, (error) => {
      if (res.headersSent) {
        return;
      }

      nextMiddleware(error);
    });
  });

  app.use((req, res) => nextHandler(req, res));

  return app;
}
