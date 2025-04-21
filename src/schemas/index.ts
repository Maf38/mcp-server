import { z } from 'zod';

// Type pour les valeurs JSON valides
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

// Fonction pour vérifier si une valeur est sérialisable en JSON
function isJSONSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

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

// 1. Schémas pour les notifications SSE
export const notificationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.literal("context/update"),
  params: z.object({
    key: z.string(),
    value: jsonValue,
    metadata: z.record(jsonValue).optional(),
    _meta: z.object({
      operation: z.enum(['create', 'update', 'delete', 'batch']),
      timestamp: z.string()
    })
  })
}).strict();

// 2. Schémas pour les requêtes MCP standard
export const mcpContextSchema = z.object({
  key: z.string().min(1, "La clé ne peut pas être vide"),
  value: jsonValue,
  metadata: z.record(jsonValue).optional()
});

export const mcpRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.enum(["context/create", "context/update", "context/delete"]),
  params: mcpContextSchema,
  id: z.union([z.string(), z.number()])
}).strict();

// 3. Schémas pour les opérations batch MCP
export const mcpBatchOperationSchema = z.object({
  key: z.string().min(1, "La clé ne peut pas être vide"),
  value: jsonValue,
  metadata: z.record(jsonValue).optional()
});

export const mcpBatchRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.literal("context/batch"),
  params: z.object({
    operations: z.array(mcpBatchOperationSchema)
  }),
  id: z.union([z.string(), z.number()])
}).strict();

// Schéma pour les capacités du serveur
export const capabilitiesSchema = z.object({
  version: z.string(),
  features: z.object({
    batch: z.boolean(),
    metadata: z.boolean(),
    sse: z.boolean()
  })
}).strict(); 