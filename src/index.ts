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
import { initDatabase } from './database';
import { errorHandler } from './middleware/error';
import { validateContext } from './utils/validation';

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

app.use((req: Request, res: Response, next) => {
  const originalJson = res.json;
  res.json = function(data: any) {
    if (req.path === '/health') {
      return originalJson.call(this, data);
    }
    
    const requestId = req.body?.id || req.headers['x-request-id'] || null;
    
    if (data.error) {
      return originalJson.call(this, {
        jsonrpc: "2.0",
        error: {
          code: data.error.code || 500,
          message: data.error.message || "Internal Server Error",
          data: data.error.data
        },
        id: requestId
      });
    }
    
    if (data.jsonrpc === "2.0") {
      return originalJson.call(this, data);
    }
    
    return originalJson.call(this, {
      jsonrpc: "2.0",
      result: {
        ...data,
        _meta: {
          timestamp: new Date().toISOString(),
          operation: req.method === 'DELETE' ? 'delete' : undefined
        }
      },
      id: requestId
    });
  };
  next();
});

// Routes
app.get('/capabilities', getCapabilities);
app.get('/health', healthCheck);

// Route SSE
app.get('/sse', async (req: Request, res: Response) => {
  logger.info('Nouvelle connexion SSE reçue');
  
  // Configuration des en-têtes SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Envoyer un message initial pour confirmer la connexion
  const connectionMessage = createMCPMessage('connection/established', {
    timestamp: new Date().toISOString(),
    status: 'connected'
  });
  res.write(`data: ${JSON.stringify(connectionMessage)}\n\n`);
  
  // Ajouter le client à la liste
  const client = res;
  sseClients.add(client);
  
  // Gérer la fermeture de connexion
  const cleanup = () => {
    logger.info('Client SSE déconnecté');
    sseClients.delete(client);
  };
  
  req.on('close', cleanup);
  req.on('error', cleanup);
  
  // Garder la connexion en vie avec un ping toutes les 30 secondes
  const keepAlive = setInterval(() => {
    try {
      const pingMessage = createMCPMessage('connection/ping', {
        timestamp: new Date().toISOString()
      });
      client.write(`data: ${JSON.stringify(pingMessage)}\n\n`);
    } catch (err) {
      clearInterval(keepAlive);
      cleanup();
    }
  }, 30000);
  
  // Nettoyer l'intervalle à la fermeture
  req.on('close', () => clearInterval(keepAlive));
});

// Route pour récupérer un contexte
app.get('/context/:key', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] || null;
  const key = req.params.key;
  console.log(`GET /context/${key} - Request ID:`, requestId);

  try {
    const row = await db.get('SELECT * FROM contexts WHERE key = ?', [key]);
    console.log('Database result:', row);

    if (!row) {
      return res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: 404,
          message: 'Context not found'
        },
        id: requestId
      });
    }

    // Parser la valeur et les métadonnées stockées
    const value = JSON.parse(row.value);
    const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;

    const response = {
      jsonrpc: "2.0",
      result: {
        key: row.key,
        value,
        metadata,
        _meta: {
          timestamp: new Date().toISOString()
        }
      },
      id: requestId
    };
    console.log('Response:', JSON.stringify(response, null, 2));

    res.json(response);
  } catch (error) {
    console.error('Error details:', error);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: 500,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      id: requestId
    });
  }
});

// Route pour sauvegarder le contexte
app.post('/context', async (req: Request, res: Response) => {
  const requestId = req.body?.id || req.headers['x-request-id'] || null;
  console.log('POST /context - Request ID:', requestId);

  try {
    const contextData = req.body?.params || req.body;
    const validation = contextSchema.safeParse(contextData);
    if (!validation.success) {
      const errorIssues = validation.error.issues.map(issue => issue.message).join(', ');
      logger.warn('Erreur de validation', { errors: errorIssues });
      return res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: 400,
          message: 'Validation error',
          data: errorIssues
        },
        id: requestId
      });
    }

    const validatedData = validation.data;
    const { key, value, metadata } = validatedData;
    const isUpdate = req.body?.method === 'context/update';
    
    // Vérifier si le contexte existe déjà
    const existingRow = await db.get('SELECT key FROM contexts WHERE key = ?', [key]);
    if (existingRow && !isUpdate) {
      return res.status(409).json({
        jsonrpc: "2.0",
        error: {
          code: 409,
          message: `Context already exists for key: ${key}`,
          details: 'Use PUT method to update existing context'
        },
        id: requestId
      });
    }

    // Insérer ou mettre à jour le contexte
    await db.run(
      'INSERT OR REPLACE INTO contexts (key, value, metadata) VALUES (?, ?, ?)',
      [key, typeof value === 'string' ? value : JSON.stringify(value), metadata ? JSON.stringify(metadata) : null]
    );
    console.log(`Context ${isUpdate ? 'updated' : 'created'} successfully: ${key}`);

    res.status(isUpdate ? 200 : 201).json({
      jsonrpc: "2.0",
      result: {
        key,
        value,
        metadata,
        _meta: {
          timestamp: new Date().toISOString(),
          operation: isUpdate ? 'update' : undefined
        }
      },
      id: requestId
    });
  } catch (error) {
    console.error('Error details:', error);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: 500,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      id: requestId
    });
  }
});

// Route pour supprimer un contexte
app.delete('/context/:key', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] || null;
  const key = req.params.key;
  console.log(`DELETE /context/${key} - Request ID:`, requestId);

  try {
    // Vérifier si le contexte existe avant de le supprimer
    const existingRow = await db.get('SELECT key FROM contexts WHERE key = ?', [key]);
    if (!existingRow) {
      return res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: 404,
          message: `Context not found for key: ${key}`
        },
        id: requestId
      });
    }

    await db.run('DELETE FROM contexts WHERE key = ?', [key]);
    console.log(`Context deleted successfully: ${key}`);

    res.json({
      jsonrpc: "2.0",
      result: {
        key,
        _meta: {
          timestamp: new Date().toISOString(),
          operation: 'delete'
        }
      },
      id: requestId
    });
  } catch (error) {
    console.error('Error details:', error);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: 500,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      id: requestId
    });
  }
});

// Route pour les opérations batch
app.post('/context/batch', async (req: Request, res: Response) => {
  const requestId = req.body?.id || req.headers['x-request-id'] || null;
  try {
    const operations = req.body?.params || [];
    const result = batchRequestSchema.safeParse(operations);
    if (!result.success) {
      return res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: 400,
          message: 'Validation error',
          data: result.error.errors
        },
        id: requestId
      });
    }

    const validatedOperations = result.data;
    const results = [];

    await db.run('BEGIN TRANSACTION');
    try {
      for (const op of validatedOperations) {
        const { key, value, metadata } = op;
        await db.run(
          'INSERT OR REPLACE INTO contexts (key, value, metadata) VALUES (?, ?, ?)',
          [key, typeof value === 'string' ? value : JSON.stringify(value), metadata ? JSON.stringify(metadata) : null]
        );
        results.push({ key, value, metadata });
      }
      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

    res.status(201).json({
      jsonrpc: "2.0",
      result: {
        results,
        _meta: {
          timestamp: new Date().toISOString(),
          operation: 'batch'
        }
      },
      id: requestId
    });
  } catch (error) {
    console.error('Error processing batch operation:', error);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: 500,
        message: 'Internal server error'
      },
      id: requestId
    });
  }
});

// Middleware de gestion des erreurs
app.use(errorHandler);

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
