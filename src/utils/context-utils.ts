import { z } from 'zod';

export function validateContext(context: unknown) {
  try {
    JSON.parse(JSON.stringify(context));
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export function serializeMetadata(metadata: unknown) {
  return metadata ? JSON.stringify(metadata) : null;
}

export function parseMetadata(metadata: string | null) {
  return metadata ? JSON.parse(metadata) : undefined;
}