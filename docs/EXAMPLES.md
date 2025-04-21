# Exemples d'utilisation du MCP avec SSE

## 1. Exemple basique : Persistance du contexte de codage

```typescript
// Client (VS Code Extension)
const context = {
  key: "coding-style",
  value: JSON.stringify({
    indentStyle: "spaces",
    indentSize: 2,
    preferredQuotes: "single"
  }),
  metadata: {
    lastUpdate: new Date().toISOString(),
    source: "user-preferences"
  }
};

// Sauvegarder le contexte
await fetch('http://localhost:3000/context', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(context)
});

// Écouter les mises à jour via SSE
const eventSource = new EventSource('http://localhost:3000/sse');
eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);
  // Mettre à jour l'IDE avec les nouvelles préférences
};
```

## 2. Exemple avancé : Synchronisation en temps réel

```typescript
// Serveur MCP avec support de synchronisation
const updates = [];

app.post('/context/sync', async (req, res) => {
  const { changes } = req.body;
  updates.push(...changes);
  
  // Notifier tous les clients connectés via SSE
  sseClients.forEach(client => {
    client.send(JSON.stringify({ type: 'sync', changes }));
  });
  
  res.status(200).json({ status: 'success' });
});
```

## 3. Exemple d'intégration avec Git

```typescript
// Surveiller les changements Git et mettre à jour le contexte
const watchGitChanges = async () => {
  const watcher = gitRepository.createFileWatcher();
  
  watcher.on('change', async (files) => {
    const context = {
      key: 'git-context',
      value: JSON.stringify(files),
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'git-change'
      }
    };
    
    await updateContext(context);
  });
};
```

## 4. Gestion des métadonnées

```typescript
// Exemple de structure de métadonnées enrichie
const contextWithMetadata = {
  key: "project-context",
  value: "...",
  metadata: {
    projectType: "typescript",
    framework: "express",
    lastModified: new Date().toISOString(),
    contributors: ["user1", "user2"],
    tags: ["backend", "api"],
    version: "1.0.0",
    environment: "development",
    dependencies: {
      express: "^4.17.1",
      typescript: "^4.5.4"
    }
  }
};
```

## 5. Gestion des erreurs et reconnexion

```typescript
const setupSSEConnection = () => {
  const eventSource = new EventSource('/sse');
  
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    // Tentative de reconnexion après 5 secondes
    setTimeout(() => {
      eventSource.close();
      setupSSEConnection();
    }, 5000);
  };
  
  return eventSource;
};
```

## 6. Exemple de batch operation

```typescript
// Envoi de multiples contextes en une seule opération
const batchUpdate = async (contexts) => {
  try {
    const response = await fetch('/context/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contexts)
    });
    
    const results = await response.json();
    console.log('Batch update results:', results);
  } catch (error) {
    console.error('Batch update failed:', error);
  }
};
```

## 7. Authentification et sécurité

```typescript
// Middleware d'authentification
const authMiddleware = (req, res, next) => {
  const authToken = req.headers['x-auth-token'];
  
  if (!authToken || !isValidToken(authToken)) {
    return res.status(401).json({
      error: 'Invalid or missing authentication token'
    });
  }
  
  next();
};

// Application du middleware
app.use('/context', authMiddleware);
app.use('/sse', authMiddleware);
```

Ces exemples montrent différentes façons d'utiliser le MCP avec SSE pour maintenir un contexte riche et réactif dans votre environnement de développement.
