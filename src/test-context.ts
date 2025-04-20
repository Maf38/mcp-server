import axios from 'axios';

async function runTests() {
  const baseUrl = 'http://localhost:3000/context';

  // 1. Créer une nouvelle clé
  let response = await axios.post(baseUrl, { key: 'test', value: 'valeur1' });
  console.log('POST 1:', response.data);

  // 2. Récupérer la clé
  response = await axios.get(baseUrl + '/test');
  console.log('GET 1:', response.data);

  // 3. Mettre à jour la clé
  response = await axios.post(baseUrl, { key: 'test', value: 'valeur2' });
  console.log('POST 2:', response.data);

  // 4. Récupérer la clé mise à jour
  response = await axios.get(baseUrl + '/test');
  console.log('GET 2:', response.data);

  // 5. Récupérer une clé inexistante
  try {
    await axios.get(baseUrl + '/inconnue');
  } catch (err: any) {
    if (err.response) {
      console.log('GET 404:', err.response.status, err.response.data);
    } else {
      console.error('Erreur inattendue:', err);
    }
  }
}

runTests().catch(console.error);
