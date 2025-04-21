import { z } from 'zod';
import { mcpContextSchema } from '../schemas';

export function validateContext(context: unknown) {
  return mcpContextSchema.safeParse(context);
}

export function serializeMetadata(metadata: unknown) {
  return metadata ? JSON.stringify(metadata) : null;
}

export function parseMetadata(metadata: string | null) {
  return metadata ? JSON.parse(metadata) : undefined;
} 