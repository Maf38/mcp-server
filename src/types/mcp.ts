import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";

// Types de base pour JSON-RPC 2.0
interface JSONRPCBase {
  jsonrpc: "2.0";
}

// Type pour les notifications (pas d'ID)
export interface MCPNotification extends JSONRPCBase {
  method: string;
  params?: {
    [key: string]: unknown;
    _meta?: {
      timestamp: string;
      operation?: string;
      [key: string]: unknown;
    };
  };
}

// Type pour les requêtes (avec ID)
export interface MCPRequest extends JSONRPCBase {
  method: string;
  params?: {
    [key: string]: unknown;
  };
  id: string | number;
}

// Type pour les réponses (avec ID)
export interface MCPResponse extends JSONRPCBase {
  id: string | number | null;
  result?: {
    [key: string]: unknown;
    _meta?: {
      timestamp: string;
      operation?: string;
      [key: string]: unknown;
    };
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Helper pour créer une notification MCP (sans ID)
export function createMCPNotification(method: string, params?: Record<string, unknown>): MCPNotification {
  return {
    jsonrpc: "2.0",
    method,
    params: params ? {
      ...params,
      _meta: {
        timestamp: new Date().toISOString(),
        ...(params._meta || {})
      }
    } : undefined
  };
}

// Helper pour créer une requête MCP (avec ID)
export function createMCPRequest(method: string, params: Record<string, unknown>, id: string | number): MCPRequest {
  return {
    jsonrpc: "2.0",
    method,
    params,
    id
  };
}

// Helper pour créer une réponse MCP réussie
export function createMCPResponse(result: Record<string, unknown>, id: string | number | null): MCPResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      ...result,
      _meta: {
        timestamp: new Date().toISOString(),
        ...(result._meta || {})
      }
    }
  };
}

// Helper pour créer une réponse d'erreur MCP
export function createMCPError(code: number, message: string, id: string | number | null, data?: unknown): MCPResponse {
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
