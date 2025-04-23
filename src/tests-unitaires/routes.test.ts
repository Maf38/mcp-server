import request from 'supertest';
import express, { Express } from 'express';

// Routes à tester
import { getCapabilities } from '../routes/capabilities';
import { healthCheck } from '../routes/health';

describe('Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('GET /capabilities', () => {
    it('devrait retourner les capacités du serveur', async () => {
      app.get('/capabilities', getCapabilities);
      
      const response = await request(app).get('/capabilities');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('features');
      expect(response.body.features).toHaveProperty('batch', true);
    });
  });

  describe('GET /health', () => {
    it('devrait retourner le statut du serveur', async () => {
      app.get('/health', healthCheck);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
