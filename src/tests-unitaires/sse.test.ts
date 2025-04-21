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
    app = await initServer();
    server = app.listen(3001);
  });

  beforeEach(async () => {
    await db.exec('DELETE FROM contexts');
  });

  afterAll((done) => {
    server.close(done);
  });

  it('devrait établir une connexion SSE et recevoir un message de connexion', (done) => {
    const es = new (EventSource as any)('http://localhost:3001/sse');
    
    es.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      expect(data).toMatchObject({
        jsonrpc: '2.0',
        method: 'connection/established',
        params: {
          status: 'connected'
        }
      });
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

    let connectionReceived = false;

    es.onmessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.method === 'connection/established') {
        connectionReceived = true;
        // Envoyer la requête de création après avoir reçu la confirmation de connexion
        try {
          const response = await request(app)
            .post('/context')
            .send({
              jsonrpc: '2.0',
              method: 'context/create',
              params: testData,
              id: '1'
            });
          
          expect(response.status).toBe(201);
        } catch (error) {
          done(error);
        }
      } else if (connectionReceived && data.method === 'context/update') {
        expect(data).toMatchObject({
          jsonrpc: '2.0',
          method: 'context/update',
          params: {
            key: testData.key,
            value: testData.value,
            metadata: testData.metadata,
            _meta: {
              operation: 'create'
            }
          }
        });
        es.close();
        done();
      }
    };

    es.onerror = (error: Error) => {
      done(error);
    };
  });

  it('devrait recevoir des notifications pour les opérations batch', (done) => {
    const es = new (EventSource as any)('http://localhost:3001/sse');
    const batchData = [
      { key: 'batch1', value: 'value1', metadata: { type: 'test' } },
      { key: 'batch2', value: 'value2', metadata: { type: 'test' } }
    ];

    let messageCount = 0;
    let connectionReceived = false;

    es.onmessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.method === 'connection/established') {
        connectionReceived = true;
        try {
          const response = await request(app)
            .post('/context/batch')
            .send({
              jsonrpc: '2.0',
              method: 'context/batch',
              params: {
                operations: batchData
              },
              id: '1'
            });
          
          expect(response.status).toBe(201);
        } catch (error) {
          done(error);
        }
      } else if (connectionReceived && data.method === 'context/update') {
        expect(data).toMatchObject({
          jsonrpc: '2.0',
          method: 'context/update',
          params: expect.objectContaining({
            _meta: {
              operation: 'batch'
            }
          })
        });
        
        messageCount++;
        if (messageCount === batchData.length) {
          es.close();
          done();
        }
      }
    };

    es.onerror = (error: Error) => {
      done(error);
    };
  });

  it('devrait recevoir des pings réguliers', (done) => {
    const es = new (EventSource as any)('http://localhost:3001/sse');
    
    es.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.method === 'connection/ping') {
        expect(data).toMatchObject({
          jsonrpc: '2.0',
          method: 'connection/ping',
          params: {}
        });
        es.close();
        done();
      }
    };

    es.onerror = (error: Error) => {
      done(error);
    };
  });

  it('devrait gérer proprement la déconnexion SSE', (done) => {
    const es = new (EventSource as any)('http://localhost:3001/sse');
    
    es.onopen = () => {
      es.close();
      // On attend un peu pour s'assurer que la déconnexion est traitée
      setTimeout(() => {
        expect(es.readyState).toBe(2); // 2 = CLOSED
        done();
      }, 100);
    };

    es.onerror = (error: Error) => {
      done(error);
    };
  });
});
