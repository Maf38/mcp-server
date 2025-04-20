import { Request, Response } from 'express';

export const getCapabilities = (req: Request, res: Response) => {
  res.json({
    version: '1.0',
    features: {
      batch: true,
      delete: true,
      metadata: true
    },
    limits: {
      maxBatchSize: 100,
      maxValueSize: 1024 * 1024 // 1MB
    }
  });
};
