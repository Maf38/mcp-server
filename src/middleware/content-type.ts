import { Request, Response, NextFunction } from 'express';

// Middleware pour définir le type de contenu MCP
export const contentTypeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.type('application/json+model-context');
  next();
};
