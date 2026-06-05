import { Request, Response } from 'express';
import { HealthResponse } from '../types';

export function getHealth(req: Request, res: Response<HealthResponse>): void {
  res.json({
    status: 'ok',
    service: 'smart-ai-explorer',
  });
}
