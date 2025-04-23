import { z } from 'zod';
import { mcpRequestSchema, mcpBatchRequestSchema, notificationSchema } from '../schemas';

export interface ValidationResult {
  success: boolean;
  error?: z.ZodError;
}

export function validateContext(context: unknown): ValidationResult {
  try {
    // First try to validate as a standard MCP request
    const result = mcpRequestSchema.safeParse(context);
    if (result.success) {
      return { success: true };
    }

    // If that fails, try as a batch request
    const batchResult = mcpBatchRequestSchema.safeParse(context);
    if (batchResult.success) {
      return { success: true };
    }

    // If both fail, return the error from the standard validation
    return {
      success: false,
      error: result.error
    };
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
        code: 'custom',
        path: [],
        message: 'Invalid request format'
      }])
    };
  }
}