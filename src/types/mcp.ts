import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";

export type MCPMessage = JSONRPCMessage;

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: {
    [key: string]: unknown;
    _meta?: {
      timestamp: string;
      [key: string]: unknown;
    };
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Helper pour créer un message MCP valide
export function createMCPMessage(method: string, params?: Record<string, unknown>): MCPMessage {
  return {
    jsonrpc: "2.0" as const,
    method,
    params: params ? {
      ...params,
      _meta: {
        timestamp: new Date().toISOString()
      }
    } : undefined
  };
}

// Helper pour créer une réponse MCP valide
export function createMCPResponse(result: Record<string, unknown>, id: string | number | null = null): MCPResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      ...result,
      _meta: {
        timestamp: new Date().toISOString()
      }
    }
  };
}

// Helper pour créer une réponse d'erreur MCP
export function createMCPError(code: number, message: string, id: string | number | null = null, data?: unknown): MCPResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data
    }
  };
}
