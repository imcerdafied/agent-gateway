export interface Delegation {
  delegation_id: string;
  guest_id: string;
  agent_id: string;
  venue_id: string;
  scopes: DelegationScope[];
  constraints: DelegationConstraints;
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  revoked_at?: string;
}

export interface DelegationScope {
  action_id: string;
  allowed: boolean;
  max_amount_per_transaction?: number;
  max_amount_per_day?: number;
  requires_confirmation_above?: number;
  custom_constraints?: Record<string, unknown>;
}

export interface DelegationConstraints {
  max_total_spend_per_day: number;
  active_hours?: {
    start: string;
    end: string;
  };
  allowed_locations?: string[];
}

export interface DelegationGrant {
  guest_id: string;
  agent_id: string;
  venue_id: string;
  scopes: DelegationScope[];
  constraints: DelegationConstraints;
  duration_hours: number;
}

export interface EscalationResult {
  escalated: boolean;
  reason?: string;
  action_id?: string;
  amount?: number;
  requires_guest_action: 'approve' | 'deny' | 'modify';
}

export interface TokenPayload {
  delegation_id: string;
  guest_id: string;
  agent_id: string;
  venue_id: string;
  scope_ids: string[];
  iat: number;
  exp: number;
}
