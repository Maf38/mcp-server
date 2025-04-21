/**
 * Crée une réponse MCP au format JSON-RPC 2.0
 */
export function createMCPResponse(result: unknown) {
  return {
    jsonrpc: '2.0',
    result
  };
}

/**
 * Crée une erreur MCP au format JSON-RPC 2.0
 */
export function createMCPError(code: number, message: string, data?: unknown) {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      ...(data ? { data } : {})
    }
  };
} 