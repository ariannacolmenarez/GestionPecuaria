import express from 'express';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/index';

export function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS headers
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  // Serve documentation assets (Word .docx, PDF, mockups)
  const docsDir = path.resolve(process.cwd(), 'docs');
  if (fs.existsSync(docsDir)) {
    app.use('/docs', express.static(docsDir));
  }

  // API Routes
  app.use('/api', apiRouter);

  // Serve static production build if available (for standalone Node / Cloud Run deployments)
  const candidateBuildDirs = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(process.cwd(), 'app/src/main/assets/public'),
  ];

  for (const staticDir of candidateBuildDirs) {
    if (fs.existsSync(staticDir) && fs.existsSync(path.join(staticDir, 'index.html'))) {
      app.use(express.static(staticDir));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/docs')) {
          return next();
        }
        res.sendFile(path.join(staticDir, 'index.html'));
      });
      break;
    }
  }

  return app;
}
