import { z } from 'zod';

// Type pour les valeurs JSON valides
type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

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

// Schéma principal pour un contexte
export const contextSchema = z.object({
  key: z.string().min(1, "La clé ne peut pas être vide"),
  value: jsonValue,
  metadata: z.record(jsonValue).optional()
});

// Schéma pour les requêtes batch
export const batchRequestSchema = z.array(contextSchema);

// Schéma pour les capacités du serveur
export const capabilitiesSchema = z.object({
  version: z.string(),
  features: z.object({
    batch: z.boolean(),
    metadata: z.boolean(),
    sse: z.boolean()
  })
}).strict();

// Schéma pour les réponses JSON-RPC 2.0
export const jsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  result: z.object({
    _meta: z.object({
      timestamp: z.string(),
      operation: z.enum(['delete', 'batch']).optional()
    })
  }).passthrough(),
  id: z.union([z.string(), z.number(), z.null()])
}); 