import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import stockRoutes from './routes/stockRoutes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json());

app.use('/api/stocks', stockRoutes);

// Global Error Handler (must be registered after all route definitions)
app.use(errorHandler);

export default app;
