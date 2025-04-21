import request from 'supertest';
import { Express } from 'express';
import { Database } from 'sqlite';
import { initServer } from '../index';
import { initializeTestDatabase } from '../config/test-database';
import EventSource from 'eventsource';

describe('SSE Tests', () => {
  let app: Express;
  let db: Database;
  let server: any;
  
  beforeAll(async () => {
    db = await initializeTestDatabase();
    app = await initServer(db);
    server = app.listen(3001);
  });

  beforeEach(async () => {
    await db.exec('DELETE FROM contexts');
  });

  afterAll((done) => {
    server.close(done);
  });

  it('devrait établir une connexion SSE', (done) => {
    const es = new (EventSource as any)('http://localhost:3001/sse');
    
    es.onopen = () => {
      expect(es.readyState).toBe(1); // 1 = OPEN
      es.close();
      done();
    };

    es.onerror = (error: Error) => {
      done(error);
    };
  });

  it('devrait recevoir des notifications lors de la création de contexte', (done) => {
    const es = new (EventSource as any)('http://localhost:3001/sse');
    const testData = {
      key: 'test-sse',
      value: 'test-value',
      metadata: { type: 'test' }
    };

    es.onopen = async () => {
      try {
        const response = await request(app)
          .post('/context')
          .send(testData);
        
        expect(response.status).toBe(201);
      } catch (error) {
        done(error);
      }
    };

    es.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      expect(data.jsonrpc).toBe('2.0');
      expect(data.method).toBe('context/update');
      expect(data.params.key).toBe(testData.key);
      expect(data.params.value).toBe(testData.value);
      expect(data.params._meta).toBeDefined();
      es.close();
      done();
    };
  });

  it('devrait recevoir des notifications pour les opérations batch', (done) => {
    const es = new (EventSource as any)('http://localhost:3001/sse');
    const batchData = [
      { key: 'batch1', value: 'value1', metadata: { type: 'test' } },
      { key: 'batch2', value: 'value2', metadata: { type: 'test' } }
    ];

    let messageCount = 0;
    let hasError = false;

    es.onopen = async () => {
      try {
        const response = await request(app)
          .post('/context/batch')
          .send(batchData);
        
        expect(response.status).toBe(200);
      } catch (error) {
        hasError = true;
        es.close();
        done(error);
      }
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        expect(data.jsonrpc).toBe('2.0');
        expect(data.method).toBe('context/update');
        expect(data.params._meta).toBeDefined();
        
        messageCount++;
        if (messageCount === batchData.length) {
          es.close();
          done();
        }
      } catch (error) {
        hasError = true;
        es.close();
        done(error);
      }
    };

    es.onerror = (error: Error) => {
      if (!hasError) {
        es.close();
        done(error);
      }
    };
  });

  // Test de déconnexion
  it('devrait gérer proprement la déconnexion SSE', (done) => {
    const es = new (EventSource as any)('http://localhost:3001/sse');
    
    es.onopen = () => {
      es.close();
      // On attend un peu pour s'assurer que la déconnexion est traitée
      setTimeout(() => {
        // Vérifie que la connexion est bien fermée
        expect(es.readyState).toBe(2); // 2 = CLOSED
        done();
      }, 100);
    };

    es.onerror = (error: Error) => {
      done(error);
    };
  });
});
