import { z } from 'zod';

// Type pour les valeurs JSON valides
type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

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

// Schémas de validation MCP
export const contextSchema = z.object({
  key: z.string().min(1, "La clé ne peut pas être vide"),
  value: jsonValue,
  metadata: z.record(jsonValue).optional()
});

export const batchRequestSchema = z.array(contextSchema);
