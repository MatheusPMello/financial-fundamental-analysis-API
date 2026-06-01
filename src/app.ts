import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import stockRoutes from './routes/stockRoutes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/stocks', stockRoutes);

// Global Error Handler (must be registered after all route definitions)
app.use(errorHandler);

export default app;
