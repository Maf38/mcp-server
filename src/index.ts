import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { z } from 'zod';
import dotenv from 'dotenv';
import { contextSchema, batchRequestSchema, jsonRpcRequestSchema } from './schemas';
import { getCapabilities } from './routes/capabilities';
import { healthCheck } from './routes/health';
import { Database } from 'sqlite';
import { Database as SQLite3Database } from 'sqlite3';
import { createContextLogger } from './utils/logger';
import { createMCPNotification, createMCPResponse, createMCPError } from './types/mcp';
import { initializeDatabase } from './config/database';
import { validateContext } from './utils/validation';

// Configuration
dotenv.config();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/context.db';

// Logger
const logger = createContextLogger('MCP Server');

// Initialisation de l'application Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Validation du Content-Type
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json(
      createMCPError(415, 'Content-Type must be application/json', null)
    );
  }
  next();
});

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
app.get('/capabilities', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id']?.toString() || null;
  res.json(createMCPResponse({
    version: '2.0.0',
    features: {
      batch: true,
      metadata: true,
      sse: true
    }
  }, requestId));
});

app.get('/health', healthCheck);

// Route SSE
app.get('/sse', async (req: Request, res: Response) => {
  logger.info('Nouvelle connexion SSE reçue');
  
  // Configuration des en-têtes SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true'
  });
  
  // Envoyer un message initial pour confirmer la connexion
  const connectionNotification = createMCPNotification('connection/established', {
    status: 'connected'
  });
  res.write(`data: ${JSON.stringify(connectionNotification)}\n\n`);
  
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
      const pingNotification = createMCPNotification('connection/ping', {});
      client.write(`data: ${JSON.stringify(pingNotification)}\n\n`);
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
  const requestId = req.headers['x-request-id']?.toString() || null;
  const key = req.params.key;
  logger.info('GET /context/:key - Récupération du contexte', { key });

  try {
    const row = await db.get('SELECT * FROM contexts WHERE key = ?', [key]);

    if (!row) {
      logger.warn('Contexte non trouvé', { key });
      return res.status(404).json(
        createMCPError(404, 'Context not found', requestId)
      );
    }

    // Parser la valeur et les métadonnées stockées
    const value = JSON.parse(row.value);
    const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;

    res.json(createMCPResponse({
      key: row.key,
      value,
      metadata
    }, requestId));
  } catch (error) {
    logger.error('Erreur lors de la récupération du contexte', { error });
    res.status(500).json(
      createMCPError(500, 'Internal server error', requestId, 
        error instanceof Error ? error.message : String(error)
      )
    );
  }
});

// Route pour sauvegarder le contexte
app.post('/context', async (req: Request, res: Response) => {
  const requestId = req.body?.id || req.headers['x-request-id']?.toString() || null;
  logger.info('POST /context - Nouvelle requête reçue', req.body);

  try {
    // Valider que c'est une requête JSON-RPC valide si nécessaire
    if (req.body?.jsonrpc) {
      const rpcValidation = jsonRpcRequestSchema.safeParse(req.body);
      if (!rpcValidation.success) {
        return res.status(400).json(
          createMCPError(400, 'Invalid JSON-RPC request', requestId, rpcValidation.error.issues)
        );
      }
    }

    // Valider les données du contexte
    const validation = contextSchema.safeParse(req.body?.params || req.body);
    if (!validation.success) {
      logger.warn('Erreur de validation', { errors: validation.error.issues });
      return res.status(400).json(
        createMCPError(400, 'Validation error', requestId, validation.error.issues)
      );
    }

    const { key, value, metadata } = validation.data;
    const isUpdate = req.body?.method === 'context/update';

    // Insérer ou mettre à jour le contexte
    await db.run(
      'INSERT OR REPLACE INTO contexts (key, value, metadata) VALUES (?, ?, ?)',
      [key, JSON.stringify(value), metadata ? JSON.stringify(metadata) : null]
    );

    // Envoyer la réponse
    res.status(isUpdate ? 200 : 201).json(createMCPResponse({
      key,
      value,
      metadata,
      _meta: {
        operation: isUpdate ? 'update' : 'create'
      }
    }, requestId));

    // Notifier les clients SSE
    const notification = createMCPNotification('context/update', {
      key,
      value,
      metadata,
      _meta: {
        operation: isUpdate ? 'update' : 'create'
      }
    });
    
    for (const client of sseClients) {
      client.write(`data: ${JSON.stringify(notification)}\n\n`);
    }

  } catch (error) {
    logger.error('Erreur lors de la sauvegarde du contexte', { error });
    res.status(500).json(
      createMCPError(500, 'Internal server error', requestId,
        error instanceof Error ? error.message : String(error)
      )
    );
  }
});

// Route pour supprimer un contexte
app.delete('/context/:key', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id']?.toString() || null;
  const key = req.params.key;
  logger.info('DELETE /context/:key - Suppression du contexte', { key });

  try {
    // Vérifier si le contexte existe avant de le supprimer
    const existingRow = await db.get('SELECT key FROM contexts WHERE key = ?', [key]);
    if (!existingRow) {
      logger.warn('Contexte non trouvé', { key });
      return res.status(404).json(
        createMCPError(404, `Context not found for key: ${key}`, requestId)
      );
    }

    await db.run('DELETE FROM contexts WHERE key = ?', [key]);
    logger.info('Contexte supprimé avec succès', { key });

    res.json(createMCPResponse({
      key,
      _meta: {
        operation: 'delete'
      }
    }, requestId));

    // Notifier les clients SSE
    const notification = createMCPNotification('context/update', {
      key,
      _meta: {
        operation: 'delete'
      }
    });
    
    for (const client of sseClients) {
      client.write(`data: ${JSON.stringify(notification)}\n\n`);
    }

  } catch (error) {
    logger.error('Erreur lors de la suppression du contexte', { error });
    res.status(500).json(
      createMCPError(500, 'Internal server error', requestId,
        error instanceof Error ? error.message : String(error)
      )
    );
  }
});

// Route pour les opérations batch
app.post('/context/batch', async (req: Request, res: Response) => {
  const requestId = req.body?.id || req.headers['x-request-id']?.toString() || null;
  logger.info('POST /context/batch - Nouvelle requête batch reçue');

  try {
    // Valider que c'est une requête JSON-RPC valide
    const rpcValidation = jsonRpcRequestSchema.safeParse(req.body);
    if (!rpcValidation.success) {
      return res.status(400).json(
        createMCPError(400, 'Invalid JSON-RPC request', requestId, rpcValidation.error.issues)
      );
    }

    const { params } = rpcValidation.data;
    
    // Valider les opérations batch
    const validation = batchRequestSchema.safeParse(params);
    if (!validation.success) {
      logger.warn('Erreur de validation batch', { errors: validation.error.issues });
      return res.status(400).json(
        createMCPError(400, 'Validation error', requestId, validation.error.issues)
      );
    }

    const operations = validation.data;
    const results = [];

    // Démarrer une transaction
    await db.exec('BEGIN TRANSACTION');
    
    try {
      for (const op of operations) {
        const { key, value, metadata } = op;
        await db.run(
          'INSERT OR REPLACE INTO contexts (key, value, metadata) VALUES (?, ?, ?)',
          [key, JSON.stringify(value), metadata ? JSON.stringify(metadata) : null]
        );
        results.push({ key, value, metadata });

        // Notifier les clients SSE pour chaque opération
        const notification = createMCPNotification('context/update', {
          key,
          value,
          metadata,
          _meta: {
            operation: 'batch'
          }
        });
        
        for (const client of sseClients) {
          client.write(`data: ${JSON.stringify(notification)}\n\n`);
        }
      }

      // Valider la transaction
      await db.exec('COMMIT');

      res.status(201).json({
        jsonrpc: '2.0',
        result: {
          results: results.map(r => ({
            key: r.key,
            value: r.value,
            metadata: r.metadata,
            _meta: {
              operation: 'batch',
              status: 'success',
              timestamp: new Date().toISOString()
            }
          })),
          _meta: {
            operation: 'batch',
            status: 'success',
            count: results.length,
            timestamp: new Date().toISOString()
          }
        },
        id: requestId
      });
    } catch (error) {
      // Annuler la transaction en cas d'erreur
      await db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Erreur lors du traitement batch', { error });
    res.status(500).json(
      createMCPError(500, 'Internal server error', requestId,
        error instanceof Error ? error.message : String(error)
      )
    );
  }
});

// Middleware de gestion des erreurs
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Erreur non gérée', { error: err });
  res.status(500).json(
    createMCPError(500, 'Internal server error', null, err.message)
  );
});

// Initialisation de la base de données
export async function initServer() {
  try {
    logger.info('Démarrage du serveur...');
    logger.info('Initialisation de la base de données', { path: DB_PATH });
    db = await initializeDatabase(DB_PATH);
    logger.info('Base de données initialisée avec succès');
    return app;
  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur', { error });
    throw error;
  }
}

async function startServer() {
  try {
    const app = await initServer();
    app.listen(PORT, () => {
      logger.info(`MCP Server démarré sur http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur', { error });
    process.exit(1);
  }
}

// Démarrage du serveur
startServer();
