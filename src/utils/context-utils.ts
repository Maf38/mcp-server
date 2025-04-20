import { z } from 'zod';

// Types pour notre contexte
export interface Context {
  key: string;
  value: string;
  metadata?: Record<string, any>;
}

// Fonction pour valider un contexte
export function validateContext(data: unknown): Context {
  const result = contextSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid context: ${result.error.message}`);
  }
  return result.data;
}

// Fonction pour préparer les métadonnées pour la BD
export function serializeMetadata(metadata?: Record<string, any>): string {
  return metadata ? JSON.stringify(metadata) : '{}';
}

// Fonction pour parser les métadonnées depuis la BD
export function parseMetadata(metadataStr: string): Record<string, any> {
  try {
    return JSON.parse(metadataStr || '{}');
  } catch {
    return {};
  }
}

// Schéma Zod exporté pour être utilisé ailleurs
export const contextSchema = z.object({
  key: z.string(),
  value: z.string(),
  metadata: z.record(z.any()).optional()
});
