const { EventSource } = require('eventsource');
const axios = require('axios');
const assert = require('assert').strict;

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TIMEOUT = 5000;

// Configuration d'axios pour JSON-RPC 2.0
const api = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json+model-context'
  }
});

// Fonction utilitaire pour attendre un certain temps
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction pour exécuter un test avec timeout
async function runTest(testName, testFn, timeout = TIMEOUT) {
  console.log(`🔄 ${testName}...`);
  try {
    await Promise.race([
      testFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout de ${testName}`)), timeout)
      )
    ]);
    console.log(`✅ ${testName} : Succès`);
  } catch (error) {
    console.log(`❌ ${testName} : Échec`);
    console.log(`   Erreur: ${error.message}`);
    throw error;
  }
}

async function testSSE() {
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
      results.failed++;
    }
  }

  // Test de connexion SSE
  await runTest('Établissement de la connexion SSE', () => {
    return new Promise((resolve, reject) => {
      const es = new EventSource(`${API_URL}/sse`);
      
      es.onopen = () => {
        es.close();
        resolve();
      };
      
      es.onerror = (error) => {
        es.close();
        reject(new Error('Erreur de connexion SSE'));
      };
    });
  });

  // Test de réception du message de connexion
  await runTest('Réception du message de connexion', () => {
    return new Promise((resolve, reject) => {
      const es = new EventSource(`${API_URL}/sse`);
      
      es.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          assert.strictEqual(message.jsonrpc, '2.0', 'Version JSON-RPC incorrecte');
          assert.strictEqual(message.method, 'connection/established', 'Méthode incorrecte');
          assert.ok(message.params.timestamp, 'Timestamp manquant');
          assert.strictEqual(message.params.status, 'connected', 'Statut incorrect');
          es.close();
          resolve();
        } catch (error) {
          es.close();
          reject(new Error(`Message de connexion invalide: ${error.message}`));
        }
      };
      
      es.onerror = (error) => {
        es.close();
        reject(new Error('Erreur de connexion SSE'));
      };
    });
  });

  // Test de notification de création de contexte
  await runTest('Notification de création de contexte', () => {
    return new Promise(async (resolve, reject) => {
      const es = new EventSource(`${API_URL}/sse`);
      let messageReceived = false;
      
      es.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.method === 'context/update') {
            assert.strictEqual(message.jsonrpc, '2.0', 'Version JSON-RPC incorrecte');
            assert.strictEqual(message.params.key, 'test-sse', 'Clé incorrecte');
            assert.deepStrictEqual(
              JSON.parse(message.params.value),
              { message: 'Test SSE' },
              'Valeur incorrecte'
            );
            assert.ok(message.params._meta.timestamp, 'Timestamp manquant');
            messageReceived = true;
            es.close();
            resolve();
          }
        } catch (error) {
          es.close();
          reject(new Error(`Message de notification invalide: ${error.message}`));
        }
      };

      // Attendre la connexion établie
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Créer un contexte
      try {
        await api.post('/context', {
          jsonrpc: '2.0',
          method: 'context/create',
          params: {
            key: 'test-sse',
            value: JSON.stringify({ message: 'Test SSE' }),
            metadata: { type: 'sse-test', timestamp: new Date().toISOString() }
          },
          id: 1
        });
      } catch (error) {
        es.close();
        reject(new Error(`Erreur lors de la création du contexte: ${error.message}`));
      }

      setTimeout(() => {
        es.close();
        if (!messageReceived) {
          reject(new Error('Timeout de réception de la notification'));
        }
      }, TIMEOUT);
    });
  });

  // Test de notification de suppression de contexte
  await runTest('Notification de suppression de contexte', () => {
    return new Promise(async (resolve, reject) => {
      const es = new EventSource(`${API_URL}/sse`);
      let messageReceived = false;
      
      es.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.method === 'context/update' && message.params._meta.operation === 'delete') {
            assert.strictEqual(message.jsonrpc, '2.0', 'Version JSON-RPC incorrecte');
            assert.strictEqual(message.params.key, 'test-sse', 'Clé incorrecte');
            assert.ok(message.params._meta.timestamp, 'Timestamp manquant');
            messageReceived = true;
            es.close();
            resolve();
          }
        } catch (error) {
          es.close();
          reject(new Error(`Message de notification invalide: ${error.message}`));
        }
      };

      // Attendre la connexion établie
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Supprimer le contexte
      try {
        await api.delete('/context/test-sse');
      } catch (error) {
        es.close();
        reject(new Error(`Erreur lors de la suppression du contexte: ${error.message}`));
      }

      setTimeout(() => {
        es.close();
        if (!messageReceived) {
          reject(new Error('Timeout de réception de la notification de suppression'));
        }
      }, TIMEOUT);
    });
  });

  // Afficher le résumé
  console.log('\n📊 Résumé des tests SSE:');
  console.log(`   Total: ${results.total}`);
  console.log(`   Réussis: ${results.passed} ✅`);
  console.log(`   Échoués: ${results.failed} ❌`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testSSE().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
}); 