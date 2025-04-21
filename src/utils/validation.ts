import { mcpContextSchema } from '../schemas';
import { z } from 'zod';

export interface ValidationResult {
  success: boolean;
  error?: z.ZodError;
}

export function validateContext(context: unknown): ValidationResult {
  try {
    mcpContextSchema.parse(context);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error
      };
    }
    return {
      success: false,
      error: new z.ZodError([{
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Erreur de validation inattendue'
      }])
    };
  }
} 