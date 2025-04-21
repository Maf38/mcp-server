import { Request, Response } from 'express';
import { createMCPResponse } from '../types/mcp';

export function getCapabilities(req: Request, res: Response) {
  const requestId = Array.isArray(req.headers['x-request-id']) 
    ? req.headers['x-request-id'][0] 
    : (req.headers['x-request-id'] || null);
    
  const capabilities = {
    version: '1.0.0',
    features: {
      batch: true,
      metadata: true,
      sse: true
    }
  };

  res.json(createMCPResponse(capabilities, requestId));
}
