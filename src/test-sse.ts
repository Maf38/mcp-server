import EventSource from 'eventsource';

console.log('Démarrage du test SSE...');

const es = new (EventSource as any)('http://localhost:3000/sse');

console.log('Connexion SSE établie');

es.onmessage = (event: MessageEvent) => {
  console.log('Message reçu:', event.data);
};

es.onerror = (error: Event) => {
  console.error('Erreur SSE:', error);
};

// Test d'envoi d'un contexte après 2 secondes
setTimeout(async () => {
  console.log('Envoi d\'un contexte de test...');
  try {
    const response = await fetch('http://localhost:3000/context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'test-sse',
        value: 'test-value',
        metadata: { type: 'test' }
      })
    });
    console.log('Contexte envoyé:', await response.json());
  } catch (error) {
    console.error('Erreur lors de l\'envoi du contexte:', error);
  }
}, 2000);

// Fermeture de la connexion après 10 secondes
setTimeout(() => {
  console.log('Fermeture de la connexion SSE');
  es.close();
  process.exit(0);
}, 10000);

// Garder le processus en vie
setInterval(() => {}, 1000); 