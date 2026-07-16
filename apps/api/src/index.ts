import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jobsRouter from './routes/jobs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const apiKeyValue = process.env.API_KEY || 'taskflow_secret_key';

app.use(cors());
app.use(express.json());

// API Key authentication middleware
const apiKeyAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== apiKeyValue) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }
  next();
};

app.use('/api/jobs', apiKeyAuth, jobsRouter);

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Stats endpoint (authenticated)
import { prisma } from '@taskflow/db';
app.get('/api/stats', apiKeyAuth, async (req, res) => {
  try {
    const counts = await prisma.job.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    });

    const statsMap: Record<string, number> = {
      PENDING: 0,
      QUEUED: 0,
      RUNNING: 0,
      SUCCESS: 0,
      FAILED: 0,
      DEAD_LETTER: 0,
      CANCELLED: 0,
    };

    counts.forEach((group: any) => {
      statsMap[group.status] = group._count._all;
    });

    // Calculate failure rate
    const totalFinished = statsMap.SUCCESS + statsMap.FAILED + statsMap.DEAD_LETTER;
    const failureRate = totalFinished > 0 
      ? ((statsMap.FAILED + statsMap.DEAD_LETTER) / totalFinished) * 100 
      : 0;

    res.json({
      counts: statsMap,
      metrics: {
        totalJobs: Object.values(statsMap).reduce((a, b) => a + b, 0),
        failureRate: parseFloat(failureRate.toFixed(2)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`TaskFlow API Service listening at http://localhost:${port}`);
});
