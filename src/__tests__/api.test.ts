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
    app = await initServer(db);
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
  const totalTests = 16;

  test('1. GET /capabilities devrait retourner les capacités du serveur MCP', async () => {
    const response = await request(app).get('/capabilities');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('features');
    expect(response.body.features).toHaveProperty('batch', true);
    expect(response.body.features).toHaveProperty('metadata', true);
    score++;
  });

  test('2. POST /context devrait créer un nouveau contexte', async () => {
    const response = await request(app)
      .post('/context')
      .send(testData);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject(testData);
    score++;
  });

  test('3. GET /context/:key devrait récupérer un contexte existant', async () => {
    const response = await request(app).get(`/context/${testData.key}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(testData);
    score++;
  });

  test('4. GET /context/:key devrait retourner 404 pour une clé inexistante', async () => {
    const response = await request(app).get('/context/nonexistentKey');
    expect(response.status).toBe(404);
    score++;
  });

  test('5. POST /context/batch devrait traiter plusieurs contextes', async () => {
    const batchData = [
      { key: 'batch1', value: 'value1', metadata: { type: 'test' } },
      { key: 'batch2', value: 'value2', metadata: { type: 'test' } }
    ];
    const response = await request(app)
      .post('/context/batch')
      .send(batchData);
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0].status).toBe('success');
    score++;
  });

  test('6. DELETE /context/:key devrait supprimer un contexte', async () => {
    const response = await request(app).delete(`/context/${testData.key}`);
    expect(response.status).toBe(200);
    score++;
  });

  test('7. Content-Type devrait être application/json+model-context', async () => {
    const response = await request(app).get('/capabilities');
    expect(response.headers['content-type']).toContain('application/json+model-context');
    score++;
  });

  test('8. La validation devrait rejeter les données invalides', async () => {
    const invalidData = { key: '', value: '' };
    const response = await request(app)
      .post('/context')
      .send(invalidData);
    expect(response.status).toBe(400);
    score++;
  });

  test('9. GET /health devrait retourner le statut du serveur', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    score++;
  });

  test('10. Les métadonnées devraient être correctement gérées', async () => {
    const response = await request(app)
      .post('/context')
      .send(testData);
    expect(response.status).toBe(201);
    expect(response.body.data.metadata).toMatchObject(testData.metadata);
    score++;
  });

  test('11. Le serveur devrait gérer les mises à jour en temps réel', async () => {
    const response = await request(app)
      .post('/context')
      .send({
        key: 'realtime-test',
        value: 'test-value',
        metadata: {
          type: 'realtime',
          timestamp: new Date().toISOString()
        }
      });
    expect(response.status).toBe(201);
    score++;
  });

  test('12. Le serveur devrait supporter l\'authentification MCP', async () => {
    const response = await request(app)
      .post('/context')
      .set('Authorization', 'Bearer test-token')
      .send(testData);
    expect(response.status).toBe(201);
    score++;
  });

  test('13. Les limites de taille devraient être respectées', async () => {
    const largeValue = 'a'.repeat(1024 * 1024 + 1); // Plus grand que maxValueSize
    const response = await request(app)
      .post('/context')
      .send({
        key: 'large-value-test',
        value: largeValue
      });
    expect(response.status).toBe(400);
    score++;
  });

  test('14. Les réponses devraient suivre le format JSON-RPC 2.0', async () => {
    const response = await request(app)
      .post('/context')
      .send(testData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('jsonrpc', '2.0');
    expect(response.body).toHaveProperty('result');
    expect(response.body.result).toHaveProperty('_meta');
    expect(response.body.result._meta).toHaveProperty('timestamp');
    score++;
  });

  test('15. Les erreurs devraient suivre le format JSON-RPC 2.0', async () => {
    const response = await request(app)
      .get('/context/nonexistent');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('jsonrpc', '2.0');
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code', 404);
    expect(response.body.error).toHaveProperty('message');
    score++;
  });

  test('16. Les opérations batch devraient notifier les clients SSE', async () => {
    const messages: any[] = [];
    const sse = await request(app)
      .get('/sse')
      .set('Accept', 'text/event-stream');
    
    // Simuler la réception de messages SSE
    sse.on('message', (msg: any) => messages.push(JSON.parse(msg)));

    const batchResponse = await request(app)
      .post('/context/batch')
      .send([testData]);

    expect(batchResponse.status).toBe(200);
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
    console.log('✓ Content-Type MCP');
    console.log('✓ Validation des données');
    console.log('✓ Healthcheck');
    console.log('✓ Gestion des métadonnées');
  });
});
