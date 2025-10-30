import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors'; 
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger';
import authRoutes from './routes/authRoutes';
import vaultRoutes from './routes/vaultRoutes';
import walletRoutes from './routes/WalletRoutes';
import transactionRoutes from './routes/transactionRoutes';
import swapRoutes from './routes/swapRoutes';
import rampRoutes from './routes/rampRoutes';
import authMiddleware from './middlewares/authMiddleware';

const prisma = new PrismaClient();
const app: Express = express();
const PORT = process.env.PORT || 9000;


app.use(express.json());


app.use(
  cors({
    origin: ['http://localhost:3002'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);



app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

app.get('/', (req, res) => {
  res.send('Backend is running inside Docker!');
});


console.log('Mounting routes...');
app.use('/auth', authRoutes);
app.use('/api', authMiddleware, transactionRoutes);
app.use('/api', vaultRoutes);
app.use('/api', authMiddleware, walletRoutes);
app.use('/api', authMiddleware, swapRoutes);
app.use('/api', authMiddleware, rampRoutes);


app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;