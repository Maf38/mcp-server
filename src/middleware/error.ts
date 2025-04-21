import { Request, Response, NextFunction } from 'express';
import { createMCPError } from '../utils/mcp';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  // Si l'erreur a déjà un code HTTP, on l'utilise
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const data = err.data || undefined;
  
  // Extraire l'ID de la requête si disponible
  const requestId = (req.body && typeof req.body === 'object' && 'id' in req.body) 
    ? req.body.id 
    : null;

  res.status(statusCode).json(createMCPError(statusCode, message, data, requestId));
} 