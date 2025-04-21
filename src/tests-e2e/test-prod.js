require('dotenv').config();
const axios = require('axios');
const assert = require('assert').strict;

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TIMEOUT = 5000; // 5 secondes

// Configuration d'axios avec timeout
const api = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
  validateStatus: null, // Ne pas rejeter les réponses HTTP, même avec des codes d'erreur
  headers: {
    'Content-Type': 'application/json'
  }
});

async function testProduction() {
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  async function runTest(name, testFn) {
    results.total++;
    try {
      console.log(`\n🔄 ${name}...`);
      await testFn();
      console.log(`✅ ${name} : Succès`);
      results.passed++;
    } catch (error) {
      console.error(`❌ ${name} : Échec`);
      console.error('   Erreur:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Détails:', JSON.stringify(error.response.data, null, 2));
      }
      results.failed++;
    }
  }

  try {
    // 1. Test de santé
    await runTest('Test du health check', async () => {
      const { data } = await api.get('/health');
      assert.ok(data.status === 'ok', 'Le statut devrait être "ok"');
      assert.ok(data.timestamp, 'Un timestamp devrait être présent');
    });

    // 2. Test des capacités
    await runTest('Test des capacités', async () => {
      const { data } = await api.get('/capabilities');
      assert.ok(data.jsonrpc === '2.0', 'Version JSON-RPC incorrecte');
      assert.ok(data.result, 'Résultat manquant');
      assert.ok(data.result.version, 'Version manquante');
      assert.ok(data.result.features, 'Features manquantes');
      assert.ok(data.result.features.batch === true, 'Support batch manquant');
      assert.ok(data.result.features.metadata === true, 'Support metadata manquant');
      assert.ok(data.result.features.sse === true, 'Support SSE manquant');
    });

    // 3. Test de validation
    await runTest('Test de validation des données', async () => {
      const { data, status } = await api.post('/context', {
        jsonrpc: "2.0",
        method: "context/create",
        params: {
          key: '',
          value: null
        },
        id: "test-validation"
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data.jsonrpc, '2.0');
      assert.ok(data.error);
      assert.strictEqual(data.error.code, 400);
      assert.ok(data.error.message.includes('Validation'));
    });

    // 4. Test CRUD simple
    const testContext = {
      key: 'test-crud',
      value: { message: 'Test value' },
      metadata: {
        type: 'test',
        environment: 'ci',
        timestamp: new Date().toISOString()
      }
    };

    await runTest('Test création de contexte', async () => {
      const { data, status } = await api.post('/context', {
        jsonrpc: "2.0",
        method: "context/create",
        params: testContext
      });
      assert.strictEqual(status, 201);
      assert.strictEqual(data.jsonrpc, '2.0');
      assert.ok(data.result, 'Résultat manquant');
      assert.strictEqual(data.result.key, testContext.key);
      assert.deepStrictEqual(data.result.value, testContext.value);
      assert.deepStrictEqual(data.result.metadata, testContext.metadata);
    });

    await runTest('Test lecture de contexte', async () => {
      const { data } = await api.get(`/context/${testContext.key}`);
      assert.strictEqual(data.jsonrpc, '2.0');
      assert.ok(data.result, 'Résultat manquant');
      assert.strictEqual(data.result.key, testContext.key);
      assert.deepStrictEqual(data.result.value, testContext.value);
      assert.deepStrictEqual(data.result.metadata, testContext.metadata);
    });

    await runTest('Test mise à jour de contexte', async () => {
      const updatedContext = {
        ...testContext,
        value: { message: 'Updated value' },
        metadata: {
          ...testContext.metadata,
          updated: true
        }
      };
      const { data } = await api.post('/context', {
        jsonrpc: "2.0",
        method: "context/update",
        params: updatedContext
      });
      assert.strictEqual(data.jsonrpc, '2.0');
      assert.ok(data.result, 'Résultat manquant');
      assert.strictEqual(data.result.key, updatedContext.key);
      assert.deepStrictEqual(data.result.value, updatedContext.value);
      assert.deepStrictEqual(data.result.metadata, updatedContext.metadata);

      const { data: readData } = await api.get(`/context/${testContext.key}`);
      assert.strictEqual(readData.jsonrpc, '2.0');
      assert.ok(readData.result, 'Résultat manquant');
      assert.deepStrictEqual(readData.result.value, updatedContext.value);
      assert.ok(readData.result.metadata.updated);
    });

    // 5. Test opération batch
    const batchData = [
      {
        key: 'batch-1',
        value: { index: 1 },
        metadata: { type: 'batch', index: 1 }
      },
      {
        key: 'batch-2',
        value: { index: 2 },
        metadata: { type: 'batch', index: 2 }
      }
    ];

    await runTest('Test opération batch', async () => {
      const { data } = await api.post('/context/batch', {
        jsonrpc: "2.0",
        method: "context/batch",
        params: {
          operations: batchData
        },
        id: "test-batch"
      });
      assert.strictEqual(data.jsonrpc, '2.0');
      assert.ok(data.result, 'Résultat manquant');
      assert.ok(Array.isArray(data.result.results), 'Le résultat devrait contenir un tableau de résultats');
      assert.strictEqual(data.result.results.length, batchData.length);
      assert.ok(data.result._meta, 'Métadonnées manquantes');
      assert.strictEqual(data.result._meta.operation, 'batch');
      
      // Vérification de chaque élément
      for (const item of batchData) {
        const { data: readData } = await api.get(`/context/${item.key}`);
        assert.strictEqual(readData.jsonrpc, '2.0');
        assert.ok(readData.result, 'Résultat manquant');
        assert.strictEqual(readData.result.key, item.key);
        assert.deepStrictEqual(readData.result.value, item.value);
        assert.deepStrictEqual(readData.result.metadata, item.metadata);
      }
    });

    // 6. Test clé inexistante
    await runTest('Test lecture clé inexistante', async () => {
      const { data, status } = await api.get('/context/cle-qui-nexiste-pas');
      assert.strictEqual(status, 404);
      assert.strictEqual(data.jsonrpc, '2.0');
      assert.ok(data.error);
      assert.strictEqual(data.error.code, 404);
      assert.strictEqual(data.error.message, 'Context not found');
    });

    // Nettoyage
    await runTest('Nettoyage des données de test', async () => {
      const keysToDelete = [testContext.key, ...batchData.map(item => item.key)];
      for (const key of keysToDelete) {
        const { data } = await api.delete(`/context/${key}`);
        assert.strictEqual(data.jsonrpc, '2.0');
        assert.ok(data.result, 'Résultat manquant dans la réponse de suppression');
        assert.strictEqual(data.result.key, key);
        assert.ok(data.result._meta, 'Métadonnées manquantes dans la réponse de suppression');
        assert.strictEqual(data.result._meta.operation, 'delete');

        const { data: checkData, status: checkStatus } = await api.get(`/context/${key}`);
        assert.strictEqual(checkStatus, 404, `La clé ${key} devrait être supprimée`);
      }
    });

  } finally {
    // Affichage du résumé
    console.log('\n📊 Résumé des tests:');
    console.log(`   Total: ${results.total}`);
    console.log(`   Réussis: ${results.passed} ✅`);
    console.log(`   Échoués: ${results.failed} ❌`);
    
    if (results.failed > 0) {
      console.error('\n❌ Certains tests ont échoué');
      process.exit(1);
    } else {
      console.log('\n✅ Tous les tests ont réussi !');
      process.exit(0);
    }
  }
}

testProduction(); 