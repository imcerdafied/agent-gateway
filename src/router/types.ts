import type { Delegation, EscalationResult } from '../delegation/types.js';

export interface ActionRequest {
  request_id: string;
  delegation_token: string;
  action_id: string;
  parameters: Record<string, unknown>;
  idempotency_key?: string;
  timestamp: string;
}

export interface ActionResponse {
  request_id: string;
  status: 'success' | 'denied' | 'escalation_required' | 'error' | 'not_found';
  action_id: string;
  result?: unknown;
  escalation?: EscalationResult;
  error?: { code: string; message: string };
  timestamp: string;
  audit_id: string;
}

export interface AuditEntry {
  audit_id: string;
  request_id: string;
  delegation_id: string;
  guest_id: string;
  agent_id: string;
  venue_id: string;
  action_id: string;
  parameters: Record<string, unknown>;
  status: ActionResponse['status'];
  amount?: number;
  escalation?: EscalationResult;
  error?: { code: string; message: string };
  timestamp: string;
  duration_ms: number;
}

export type ActionHandler = (
  params: Record<string, unknown>,
  context: {
    guest_id: string;
    agent_id: string;
    venue_id: string;
    delegation: Delegation;
  }
) => Promise<{ success: boolean; result?: unknown; error?: string }>;
