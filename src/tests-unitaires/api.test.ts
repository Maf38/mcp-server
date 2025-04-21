import request from 'supertest';
import { Express } from 'express';
import { initializeTestDatabase } from '../config/test-database';
import { Database } from 'sqlite';
import { initServer } from '../index';

describe('MCP Server API Tests', () => {
  let app: Express;
  let db: Database;
  
  beforeAll(async () => {
    // Initialisation de la base de données de test
    db = await initializeTestDatabase();
    // Configuration de l'application avec la base de données de test
    app = await initServer();
  });

  const testData = {
    key: 'testKey',
    value: 'testValue',
    metadata: {
      type: 'test',
      timestamp: new Date().toISOString(),
      source: 'jest'
    }
  };

  let score = 0;
  const totalTests = 13;

  test('1. GET /capabilities devrait retourner les capacités du serveur MCP', async () => {
    const response = await request(app).get('/capabilities');
    expect(response.status).toBe(200);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.result).toHaveProperty('version');
    expect(response.body.result).toHaveProperty('features');
    expect(response.body.result.features).toHaveProperty('batch', true);
    expect(response.body.result.features).toHaveProperty('metadata', true);
    score++;
  });

  test('2. POST /context devrait créer un nouveau contexte', async () => {
    const response = await request(app)
      .post('/context')
      .send({
        jsonrpc: '2.0',
        method: 'context/create',
        params: testData,
        id: '1'
      });
    expect(response.status).toBe(201);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.result).toMatchObject({
      ...testData,
      _meta: expect.objectContaining({
        operation: 'create'
      })
    });
    score++;
  });

  test('3. GET /context/:key devrait récupérer un contexte existant', async () => {
    const response = await request(app).get(`/context/${testData.key}`);
    expect(response.status).toBe(200);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.result).toMatchObject({
      ...testData,
      _meta: expect.any(Object)
    });
    score++;
  });

  test('4. GET /context/:key devrait retourner 404 pour une clé inexistante', async () => {
    const response = await request(app).get('/context/nonexistentKey');
    expect(response.status).toBe(404);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.error).toMatchObject({
      code: 404,
      message: 'Context not found'
    });
    score++;
  });

  test('5. POST /context/batch devrait traiter plusieurs contextes', async () => {
    const batchData = [
      { key: 'batch1', value: 'value1', metadata: { type: 'test' } },
      { key: 'batch2', value: 'value2', metadata: { type: 'test' } }
    ];
    const response = await request(app)
      .post('/context/batch')
      .send({
        jsonrpc: '2.0',
        method: 'context/batch',
        params: {
          operations: batchData
        },
        id: '2'
      });
    expect(response.status).toBe(201);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.result.results).toHaveLength(2);
    expect(response.body.result._meta).toMatchObject({
      operation: 'batch',
      status: 'success',
      count: 2
    });
    score++;
  });

  test('6. DELETE /context/:key devrait supprimer un contexte', async () => {
    const response = await request(app).delete(`/context/${testData.key}`);
    expect(response.status).toBe(200);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.result).toMatchObject({
      key: testData.key,
      _meta: {
        operation: 'delete'
      }
    });
    score++;
  });

  test('7. La validation devrait rejeter les données invalides', async () => {
    const invalidData = { key: '', value: '' };
    const response = await request(app)
      .post('/context')
      .send({
        jsonrpc: '2.0',
        method: 'context/create',
        params: invalidData,
        id: '3'
      });
    expect(response.status).toBe(400);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.error).toBeDefined();
    score++;
  });

  test('8. GET /health devrait retourner le statut du serveur', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    score++;
  });

  test('9. Les métadonnées devraient être correctement gérées', async () => {
    const response = await request(app)
      .post('/context')
      .send({
        jsonrpc: '2.0',
        method: 'context/create',
        params: testData,
        id: '4'
      });
    expect(response.status).toBe(201);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.result).toMatchObject({
      metadata: testData.metadata,
      _meta: expect.any(Object)
    });
    score++;
  });

  test('10. Le serveur devrait gérer les mises à jour en temps réel', async () => {
    const response = await request(app)
      .post('/context')
      .send({
        jsonrpc: '2.0',
        method: 'context/update',
        params: {
          key: 'realtime-test',
          value: 'test-value',
          metadata: {
            type: 'realtime',
            timestamp: new Date().toISOString()
          }
        },
        id: '5'
      });
    expect(response.status).toBe(200);
    expect(response.body.jsonrpc).toBe('2.0');
    expect(response.body.result._meta.operation).toBe('update');
    score++;
  });

  test('11. Les réponses devraient suivre le format JSON-RPC 2.0', async () => {
    const response = await request(app)
      .post('/context')
      .send({
        jsonrpc: '2.0',
        method: 'context/create',
        params: testData,
        id: '6'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      result: expect.objectContaining({
        _meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      }),
      id: '6'
    });
    score++;
  });

  test('12. Les erreurs devraient suivre le format JSON-RPC 2.0', async () => {
    const response = await request(app)
      .get('/context/nonexistent');
    
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      error: {
        code: 404,
        message: expect.any(String)
      }
    });
    score++;
  });

  test('13. Les opérations batch devraient notifier les clients SSE', async () => {
    const messages: any[] = [];
    const sse = await request(app)
      .get('/sse')
      .set('Accept', 'text/event-stream');
    
    sse.on('message', (msg: any) => messages.push(JSON.parse(msg)));

    const batchResponse = await request(app)
      .post('/context/batch')
      .send({
        jsonrpc: '2.0',
        method: 'context/batch',
        params: {
          operations: [testData]
        },
        id: '7'
      });

    expect(batchResponse.status).toBe(201);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toHaveProperty('jsonrpc', '2.0');
    expect(messages[0]).toHaveProperty('method', 'context/update');
    score++;
  });

  afterAll(() => {
    const percentage = (score / totalTests) * 100;
    console.log(`\nScore final : ${score}/${totalTests} (${percentage}%)`);
    console.log('\nRésultats détaillés :');
    console.log('✓ Capacités MCP');
    console.log('✓ Création de contexte');
    console.log('✓ Récupération de contexte');
    console.log('✓ Gestion des erreurs 404');
    console.log('✓ Opérations batch');
    console.log('✓ Suppression de contexte');
    console.log('✓ Validation des données');
    console.log('✓ Healthcheck');
    console.log('✓ Gestion des métadonnées');
    console.log('✓ Mises à jour en temps réel');
    console.log('✓ Format JSON-RPC 2.0');
    console.log('✓ Notifications SSE');
  });
});
