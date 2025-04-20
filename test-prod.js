const axios = require('axios');

const API_URL = 'http://192.168.1.187:3000';

async function testProduction() {
  try {
    // 1. Test de santé
    console.log('1. Test du health check...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('✓ Serveur en ligne:', health.data);

    // 2. Test des capacités
    console.log('\n2. Vérification des capacités du serveur...');
    const capabilities = await axios.get(`${API_URL}/capabilities`);
    console.log('✓ Capacités du serveur:', capabilities.data);

    // 3. Test d'écriture/lecture simple
    console.log('\n3. Test d\'écriture et lecture...');
    const testContext = {
      key: 'ide-test',
      value: 'Configuration de test IDE',
      metadata: {
        type: 'configuration',
        environment: 'production',
        timestamp: new Date().toISOString()
      }
    };

    console.log('   Écriture du contexte...');
    const createResponse = await axios.post(`${API_URL}/context`, testContext);
    console.log('✓ Contexte créé:', createResponse.data);

    console.log('   Lecture du contexte...');
    const readResponse = await axios.get(`${API_URL}/context/${testContext.key}`);
    console.log('✓ Contexte lu:', readResponse.data);

    // 4. Test d'opération batch
    console.log('\n4. Test d\'opération batch...');
    const batchData = [
      {
        key: 'config-1',
        value: 'Configuration 1',
        metadata: { type: 'config', priority: 'high' }
      },
      {
        key: 'config-2',
        value: 'Configuration 2',
        metadata: { type: 'config', priority: 'medium' }
      }
    ];

    const batchResponse = await axios.post(`${API_URL}/context/batch`, batchData);
    console.log('✓ Opération batch réussie:', batchResponse.data);

    // 5. Test de suppression
    console.log('\n5. Test de suppression...');
    const deleteResponse = await axios.delete(`${API_URL}/context/${testContext.key}`);
    console.log('✓ Suppression réussie:', deleteResponse.data);

    // Vérification finale
    try {
      await axios.get(`${API_URL}/context/${testContext.key}`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✓ Vérification de suppression: Le contexte a bien été supprimé');
      }
    }

    console.log('\n✅ Tous les tests ont réussi ! Le serveur est prêt pour la production.');

  } catch (error) {
    console.error('\n❌ Erreur pendant les tests:', error.response ? error.response.data : error.message);
    console.error('Status:', error.response ? error.response.status : 'N/A');
    process.exit(1);
  }
}

testProduction(); 