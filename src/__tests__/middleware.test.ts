import { Request, Response } from 'express';
import { contentTypeMiddleware } from '../middleware/content-type';

describe('Middleware', () => {
  describe('contentTypeMiddleware', () => {
    it('devrait définir le type de contenu MCP', () => {
      const req = {} as Request;
      const res = {
        type: jest.fn()
      } as unknown as Response;
      const next = jest.fn();

      contentTypeMiddleware(req, res, next);

      expect(res.type).toHaveBeenCalledWith('application/json+model-context');
      expect(next).toHaveBeenCalled();
    });
  });
});
