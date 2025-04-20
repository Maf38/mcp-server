import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { z } from 'zod';
import dotenv from 'dotenv';
import { contentTypeMiddleware } from './middleware/content-type';
import { contextSchema, batchRequestSchema } from './schemas';
import { getCapabilities } from './routes/capabilities';
import { healthCheck } from './routes/health';
import { initializeDatabase } from './config/database';
import { Database } from 'sqlite';

// Charger les variables d'environnement
dotenv.config();

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/app/data/context.db';

// Initialisation de l'application Express
const app = express();

// Middleware pour parser les requêtes JSON
app.use(bodyParser.json());

// Middleware pour définir le type de contenu MCP
app.use(contentTypeMiddleware);

let db: Database;

// Route pour les capacités du serveur (MCP)
app.get('/capabilities', getCapabilities);

// Route pour sauvegarder le contexte
app.post('/context', async (req: Request, res: Response) => {
  console.log('[MCP Server] POST /context - Nouvelle requête reçue:', req.body.key);
  try {
    const validatedData = contextSchema.parse(req.body);
    const { key, value, metadata } = validatedData;
    console.log(`[MCP Server] Sauvegarde du contexte - Clé: ${key}`);

    await db.run(
      'INSERT OR REPLACE INTO context (key, value, metadata) VALUES (?, ?, ?)',
      [key, value, JSON.stringify(metadata || {})]
    );
    console.log(`[MCP Server] Contexte sauvegardé avec succès - Clé: ${key}`);
    
    res.status(201).json({ 
      message: 'Context saved successfully',
      data: { key, value, metadata }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[MCP Server] Erreur de validation:', error.errors);
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('[MCP Server] Erreur de base de données:', error);
      res.status(500).json({ error: 'Failed to save context' });
    }
  }
});

// Route pour les opérations batch
app.post('/context/batch', async (req: Request, res: Response) => {
  console.log('[MCP Server] POST /context/batch - Nouvelle requête batch reçue');
  try {
    const batch = batchRequestSchema.parse(req.body);
    console.log(`[MCP Server] Traitement batch - ${batch.length} éléments`);
    
    const results = [];
    await db.run('BEGIN TRANSACTION');
    
    for (const item of batch) {
      try {
        console.log(`[MCP Server] Traitement élément batch - Clé: ${item.key}`);
        await db.run(
          'INSERT OR REPLACE INTO context (key, value, metadata) VALUES (?, ?, ?)',
          [item.key, item.value, JSON.stringify(item.metadata || {})]
        );
        results.push({ key: item.key, status: 'success' });
      } catch (error) {
        console.error(`[MCP Server] Erreur pour la clé ${item.key}:`, error);
        results.push({ key: item.key, status: 'error', error: String(error) });
      }
    }
    
    await db.run('COMMIT');
    console.log('[MCP Server] Opération batch terminée avec succès');
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Batch operation error:', error);
      res.status(500).json({ error: 'Failed to process batch operation' });
    }
  }
});

// Route pour récupérer le contexte
app.get('/context/:key', async (req: Request, res: Response) => {
  const { key } = req.params;
  console.log(`[MCP Server] GET /context/${key} - Récupération de contexte`);
  try {
    const result = await db.get('SELECT value, metadata FROM context WHERE key = ?', [key]);
    
    if (result) {
      console.log(`[MCP Server] Contexte trouvé - Clé: ${key}`);
      const metadata = JSON.parse(result.metadata || '{}');
      res.json({ 
        key, 
        value: result.value,
        metadata
      });
    } else {
      console.log(`[MCP Server] Contexte non trouvé - Clé: ${key}`);
      res.status(404).json({ error: 'Context not found' });
    }
  } catch (error) {
    console.error('[MCP Server] Erreur lors de la récupération:', error);
    res.status(500).json({ error: 'Failed to retrieve context' });
  }
});

// Route pour supprimer un contexte
app.delete('/context/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const result = await db.run('DELETE FROM context WHERE key = ?', [key]);
    
    if (result && result.changes && result.changes > 0) {
      res.json({ message: 'Context deleted successfully' });
    } else {
      res.status(404).json({ error: 'Context not found' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to delete context' });
  }
});

// Health check endpoint
app.get('/health', healthCheck);

// Initialisation du serveur
export async function initServer(testDb?: Database) {
  try {
    console.log('[MCP Server] Démarrage du serveur...');
    if (testDb) {
      console.log('[MCP Server] Utilisation de la base de test');
      db = testDb;
    } else {
      console.log(`[MCP Server] Initialisation de la base de données: ${DB_PATH}`);
      db = await initializeDatabase(DB_PATH);
    }
    console.log('[MCP Server] Base de données initialisée avec succès');
    return app;
  } catch (error) {
    console.error('[MCP Server] Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
};

// Démarrage du serveur uniquement si exécuté directement
if (require.main === module) {
  initServer().then(app => {
    app.listen(PORT, () => {
      console.log(`MCP Server is running on http://localhost:${PORT}`);
    });
  });
}
