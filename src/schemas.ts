import { z } from 'zod';

// Schémas de validation MCP
export const contextSchema = z.object({
  key: z.string().min(1, "La clé ne peut pas être vide"),
  value: z.string().min(1, "La valeur ne peut pas être vide"),
  metadata: z.record(z.any()).optional() // Permet n'importe quel objet JSON comme metadata
});

export const batchRequestSchema = z.array(contextSchema);
