import { Router, Request, Response } from 'express';
import { prisma, JobStatus } from '@taskflow/db';
import parser from 'cron-parser';

const router = Router();

// POST /api/jobs - Create a job
router.post('/', async (req: Request, res: Response) => {
  const { type, payload, runAt, cronExpr, maxAttempts, idempotencyKey } = req.body;
  try {
    if (!type) {
      return res.status(400).json({ error: 'Job type is required' });
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload must be a valid JSON object' });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existingJob = await prisma.job.findUnique({
        where: { idempotencyKey },
      });
      if (existingJob) {
        return res.status(200).json(existingJob);
      }
    }

    let calculatedRunAt = new Date();

    // Validate and process cron expression
    if (cronExpr) {
      try {
        const interval = parser.parseExpression(cronExpr);
        if (!runAt) {
          calculatedRunAt = interval.next().toDate();
        } else {
          calculatedRunAt = new Date(runAt);
        }
      } catch (err) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }
    } else if (runAt) {
      calculatedRunAt = new Date(runAt);
    }

    const job = await prisma.job.create({
      data: {
        type,
        payload,
        status: 'PENDING',
        runAt: calculatedRunAt,
        cronExpr: cronExpr || null,
        maxAttempts: maxAttempts !== undefined ? parseInt(maxAttempts, 10) : 3,
        attempts: 0,
        idempotencyKey: idempotencyKey || null,
      },
    });

    res.status(201).json(job);
  } catch (error: any) {
    if (error.code === 'P2002') {
      // A concurrent request may pass the initial lookup before the unique
      // constraint is written. Return the original resource, preserving the
      // idempotency contract instead of exposing a transient 409.
      const existingJob = idempotencyKey
        ? await prisma.job.findUnique({ where: { idempotencyKey } })
        : null;
      if (existingJob) return res.status(200).json(existingJob);
      return res.status(409).json({ error: 'Idempotency key collision' });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jobs - List jobs (paginated & filtered)
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const type = req.query.type as string;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status as JobStatus;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { id: { contains: search } },
        { idempotencyKey: { contains: search } },
      ];
    }

    const [jobs, total] = await prisma.$transaction([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jobs/:id - Get job detail + logs
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        logs: {
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/jobs/:id/retry - Manually retry a failed/DLQ job
router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'FAILED' && job.status !== 'DEAD_LETTER') {
      return res.status(400).json({ error: 'Only failed or dead letter jobs can be retried' });
    }

    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        status: 'PENDING',
        attempts: 0,
        runAt: new Date(), // run immediately
      },
    });

    res.json(updatedJob);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/jobs/:id - Cancel a pending job
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'PENDING' && job.status !== 'QUEUED') {
      return res.status(400).json({ error: 'Only pending or queued jobs can be cancelled' });
    }

    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
      },
    });

    res.json(updatedJob);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jobs/:id/logs - Get execution logs for a job
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.executionLog.findMany({
      where: { jobId: req.params.id },
      orderBy: { startedAt: 'desc' },
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
