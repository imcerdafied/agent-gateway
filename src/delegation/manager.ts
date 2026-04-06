import { v4 as uuidv4 } from 'uuid';
import type { Delegation, DelegationGrant, EscalationResult } from './types.js';
import { signToken, verifyToken, decodeToken } from './token.js';
import { checkEscalation } from './escalation.js';

export class DelegationManager {
  private secret: string;
  private delegations: Map<string, Delegation> = new Map();
  private dailySpend: Map<string, Map<string, number>> = new Map();

  constructor(options?: { secret: string }) {
    this.secret = options?.secret ?? 'agent-gateway-default-secret';
  }

  grant(request: DelegationGrant): { delegation: Delegation; token: string } {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.duration_hours * 60 * 60 * 1000);
    const delegation: Delegation = {
      delegation_id: uuidv4(),
      guest_id: request.guest_id,
      agent_id: request.agent_id,
      venue_id: request.venue_id,
      scopes: request.scopes,
      constraints: request.constraints,
      status: 'active',
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
    this.delegations.set(delegation.delegation_id, delegation);
    this.dailySpend.set(delegation.delegation_id, new Map());
    const token = signToken(delegation, this.secret);
    return { delegation, token };
  }

  check(token: string, action_id: string, amount?: number): {
    permitted: boolean;
    delegation: Delegation;
    escalation?: EscalationResult;
    reason?: string;
  } {
    const verified = verifyToken(token, this.secret);
    if (!verified.valid || !verified.payload) {
      // Token may be expired per JWT but we still need to check via delegation record
      // Try to decode without verification to get the delegation_id
      const decoded = (() => {
        try {
          return decodeToken(token);
        } catch {
          return null;
        }
      })();

      if (decoded) {
        const delegation = this.delegations.get(decoded.delegation_id);
        if (delegation) {
          if (new Date(delegation.expires_at) < new Date()) {
            if (delegation.status !== 'revoked') delegation.status = 'expired';
            return { permitted: false, delegation, reason: 'Delegation has expired' };
          }
          if (delegation.status === 'revoked') {
            return { permitted: false, delegation, reason: 'Delegation has been revoked' };
          }
        }
      }
      throw new Error(verified.error ?? 'Invalid token');
    }

    const delegation = this.delegations.get(verified.payload.delegation_id);
    if (!delegation) throw new Error('Delegation not found');

    if (delegation.status === 'revoked') {
      return { permitted: false, delegation, reason: 'Delegation has been revoked' };
    }
    if (delegation.status === 'expired' || new Date(delegation.expires_at) <= new Date()) {
      if (delegation.status !== 'expired') delegation.status = 'expired';
      return { permitted: false, delegation, reason: 'Delegation has expired' };
    }

    // Check active hours
    if (delegation.constraints.active_hours) {
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);
      const { start, end } = delegation.constraints.active_hours;
      if (timeStr < start || timeStr > end) {
        return { permitted: false, delegation, reason: `Outside active hours (${start} - ${end})` };
      }
    }

    // Check scope
    const scope = delegation.scopes.find((s) => s.action_id === action_id && s.allowed);
    if (!scope) {
      return { permitted: false, delegation, reason: `Action '${action_id}' is not in delegation scope` };
    }

    // Get current daily spend
    const spendMap = this.dailySpend.get(delegation.delegation_id);
    const actionSpend = spendMap?.get(action_id) ?? 0;
    const totalSpend = spendMap ? Array.from(spendMap.values()).reduce((a, b) => a + b, 0) : 0;

    // Check escalation first (confirmation threshold and per-action daily limit)
    const escalation = checkEscalation(delegation, action_id, amount, actionSpend, new Date());
    if (escalation.escalated) {
      return { permitted: false, delegation, escalation, reason: escalation.reason };
    }

    // Check per-transaction limit (hard deny, no escalation)
    if (amount !== undefined && scope.max_amount_per_transaction !== undefined && amount > scope.max_amount_per_transaction) {
      return { permitted: false, delegation, reason: `Amount $${amount} exceeds per-transaction limit of $${scope.max_amount_per_transaction}` };
    }

    // Check total daily spend
    if (amount !== undefined && totalSpend + amount > delegation.constraints.max_total_spend_per_day) {
      return {
        permitted: false, delegation,
        escalation: { escalated: true, reason: `Would bring total daily spend to $${totalSpend + amount}, exceeding $${delegation.constraints.max_total_spend_per_day} limit`, action_id, amount, requires_guest_action: 'approve' },
        reason: 'Would exceed daily total spend limit',
      };
    }

    return { permitted: true, delegation };
  }

  revoke(delegation_id: string): void {
    const delegation = this.delegations.get(delegation_id);
    if (!delegation) throw new Error('Delegation not found');
    delegation.status = 'revoked';
    delegation.revoked_at = new Date().toISOString();
  }

  listForGuest(guest_id: string): Delegation[] {
    return Array.from(this.delegations.values()).filter((d) => d.guest_id === guest_id && d.status === 'active');
  }

  get(delegation_id: string): Delegation | null {
    return this.delegations.get(delegation_id) ?? null;
  }

  recordTransaction(delegation_id: string, action_id: string, amount: number): void {
    let spendMap = this.dailySpend.get(delegation_id);
    if (!spendMap) {
      spendMap = new Map();
      this.dailySpend.set(delegation_id, spendMap);
    }
    const current = spendMap.get(action_id) ?? 0;
    spendMap.set(action_id, current + amount);
  }
}
