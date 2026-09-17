import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { db } from './db/store';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRouter from './routes/auth';
import scholarshipsRouter from './routes/scholarships';
import categoriesRouter from './routes/categories';
import studentRouter from './routes/student';
import adminRouter from './routes/admin';

export const app = express();

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow Vite and local asset embedding
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching local origins
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev, tighten in production
      }
    },
    credentials: true,
  })
);

app.use(cookieParser(config.cookieSecret));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routers
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/scholarships', scholarshipsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/student', studentRouter);
app.use('/api/v1/admin', adminRouter);

// Centralized error handler
app.use(errorHandler);

// Bootstrap and listen
export async function startServer(): Promise<void> {
  await db.init();
  const server = app.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(` ScholarPath REST API Server`);
    console.log(` Running on: http://localhost:${config.port}`);
    console.log(` Environment: ${config.env}`);
    console.log(`=========================================`);
  });
  return new Promise((resolve) => server.on('listening', resolve));
}

// Only start when run directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
