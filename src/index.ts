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
  try {
    const validatedData = contextSchema.parse(req.body);
    const { key, value, metadata } = validatedData;

    await db.run(
      'INSERT OR REPLACE INTO context (key, value, metadata) VALUES (?, ?, ?)',
      [key, value, JSON.stringify(metadata || {})]
    );
    
    res.status(201).json({ 
      message: 'Context saved successfully',
      data: { key, value, metadata }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Failed to save context' });
    }
  }
});

// Route pour les opérations batch
app.post('/context/batch', async (req: Request, res: Response) => {
  try {
    const batch = batchRequestSchema.parse(req.body);
    
    const results = [];
    await db.run('BEGIN TRANSACTION');
    
    for (const item of batch) {
      try {
        await db.run(
          'INSERT OR REPLACE INTO context (key, value, metadata) VALUES (?, ?, ?)',
          [item.key, item.value, JSON.stringify(item.metadata || {})]
        );
        results.push({ key: item.key, status: 'success' });
      } catch (error) {
        results.push({ key: item.key, status: 'error', error: String(error) });
      }
    }
    
    await db.run('COMMIT');
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
  try {
    const { key } = req.params;
    const result = await db.get('SELECT value, metadata FROM context WHERE key = ?', [key]);
    
    if (result) {
      const metadata = JSON.parse(result.metadata || '{}');
      res.json({ 
        key, 
        value: result.value,
        metadata
      });
    } else {
      res.status(404).json({ error: 'Context not found' });
    }
  } catch (error) {
    console.error('Database error:', error);
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
    if (testDb) {
      db = testDb;
    } else {
      db = await initializeDatabase(DB_PATH);
    }
    return app;
  } catch (error) {
    console.error('Failed to initialize database:', error);
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
