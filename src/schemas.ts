import { z } from 'zod';
import type { JSONValue } from './types/json';

// Schéma récursif pour les valeurs JSON
const jsonValue: z.ZodType<JSONValue> = z.lazy(() => 
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(jsonValue)
  ])
);

// Schéma pour une requête JSON-RPC 2.0
export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.enum(['context/create', 'context/update', 'context/delete', 'context/batch']),
  params: z.lazy(() => contextSchema),
  id: z.union([z.string(), z.number(), z.null()]).optional()
});

// Schémas de validation MCP
export const contextSchema = z.object({
  key: z.string().min(1, "La clé ne peut pas être vide"),
  value: jsonValue,
  metadata: z.record(jsonValue).optional()
});

export const batchRequestSchema = z.array(contextSchema);
