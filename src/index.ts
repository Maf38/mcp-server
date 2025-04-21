import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { z } from 'zod';
import dotenv from 'dotenv';
import { contentTypeMiddleware } from './middleware/content-type';
import { contextSchema, batchRequestSchema } from './schemas';
import { getCapabilities } from './routes/capabilities';
import { healthCheck } from './routes/health';
import { initializeDatabase } from './config/database';
import { Database } from 'sqlite';
import { createContextLogger } from './utils/logger';
import { createMCPMessage, createMCPResponse, createMCPError } from './types/mcp';

// Configuration
dotenv.config();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/app/data/context.db';

// Logger
const logger = createContextLogger('MCP Server');

// Initialisation de l'application Express
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(contentTypeMiddleware);

let db: Database;
const sseClients = new Set<Response>();

// Routes
app.get('/capabilities', getCapabilities);
app.get('/health', healthCheck);

// Route SSE
app.get('/sse', async (req: Request, res: Response) => {
  logger.info('Nouvelle connexion SSE reçue');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const client = res;
  sseClients.add(client);
  
  req.on('close', () => {
    logger.info('Client SSE déconnecté');
    sseClients.delete(client);
  });
});

// Route pour sauvegarder le contexte
app.post('/context', async (req: Request, res: Response) => {
  logger.info('POST /context - Nouvelle requête reçue', { key: req.body.key });
  try {
    const validatedData = contextSchema.parse(req.body);
    const { key, value, metadata } = validatedData;
    logger.debug('Sauvegarde du contexte', { key, metadata });

    await db.run(
      'INSERT OR REPLACE INTO context (key, value, metadata) VALUES (?, ?, ?)',
      [key, value, JSON.stringify(metadata || {})]
    );
    logger.info('Contexte sauvegardé avec succès', { key });
    
    // Notification SSE
    const notification = createMCPMessage('context/update', { key, value, metadata });
    sseClients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(notification)}\n\n`);
      } catch (err) {
        const error = err as Error;
        logger.error('Erreur lors de la notification SSE', { 
          errorMessage: error.message, 
          key 
        });
      }
    });

    res.status(201).json(createMCPResponse({ key, value, metadata }));
  } catch (err) {
    const error = err as Error;
    if (error instanceof z.ZodError) {
      logger.warn('Erreur de validation', { errors: error.errors });
      res.status(400).json(createMCPError(400, 'Validation error', error.errors));
    } else {
      logger.error('Erreur de base de données', { 
        errorMessage: error.message 
      });
      res.status(500).json(createMCPError(500, 'Failed to save context'));
    }
  }
});

// Route pour les opérations batch
app.post('/context/batch', async (req: Request, res: Response) => {
  logger.info('POST /context/batch - Nouvelle requête batch reçue');
  try {
    const batch = batchRequestSchema.parse(req.body);
    logger.info('Traitement batch', { count: batch.length });
    
    const results = [];
    await db.run('BEGIN TRANSACTION');
    
    for (const item of batch) {
      try {
        logger.debug('Traitement élément batch', { key: item.key });
        await db.run(
          'INSERT OR REPLACE INTO context (key, value, metadata) VALUES (?, ?, ?)',
          [item.key, item.value, JSON.stringify(item.metadata || {})]
        );
        
        // Notification SSE
        const notification = createMCPMessage('context/update', {
          key: item.key,
          value: item.value,
          metadata: item.metadata
        });
        sseClients.forEach(client => {
          client.write(`data: ${JSON.stringify(notification)}\n\n`);
        });
        
        results.push({ 
          key: item.key, 
          status: 'success'
        });
      } catch (err) {
        const error = err as Error;
        logger.error('Erreur batch pour une clé', { 
          key: item.key, 
          errorMessage: error.message 
        });
        results.push({ 
          key: item.key, 
          status: 'error', 
          error: error.message
        });
      }
    }
    
    await db.run('COMMIT');
    logger.info('Opération batch terminée', { 
      total: batch.length, 
      success: results.filter(r => r.status === 'success').length 
    });
    
    res.json(createMCPResponse({
      operations: results,
      stats: {
        total: batch.length,
        success: results.filter(r => r.status === 'success').length
      }
    }));
  } catch (err) {
    const error = err as Error;
    await db.run('ROLLBACK');
    if (error instanceof z.ZodError) {
      logger.warn('Erreur de validation batch', { errors: error.errors });
      res.status(400).json(createMCPError(400, 'Validation error', error.errors));
    } else {
      logger.error('Erreur opération batch', { 
        errorMessage: error.message 
      });
      res.status(500).json(createMCPError(500, 'Failed to process batch operation'));
    }
  }
});

// Initialisation du serveur
export async function initServer(testDb?: Database) {
  try {
    logger.info('Démarrage du serveur...');
    if (testDb) {
      logger.debug('Utilisation de la base de test');
      db = testDb;
    } else {
      logger.info('Initialisation de la base de données', { path: DB_PATH });
      db = await initializeDatabase(DB_PATH);
    }
    logger.info('Base de données initialisée avec succès');
    return app;
  } catch (err) {
    const error = err as Error;
    logger.error('Erreur lors de l\'initialisation de la base de données', {
      errorMessage: error.message
    });
    throw error;
  }
}

// Démarrage du serveur
if (require.main === module) {
  initServer().then(app => {
    app.listen(PORT, () => {
      logger.info(`MCP Server démarré sur http://localhost:${PORT}`);
    });
  });
}
