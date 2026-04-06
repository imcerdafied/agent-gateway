import type { Delegation, EscalationResult } from './types.js';

export function checkEscalation(
  delegation: Delegation,
  action_id: string,
  amount?: number,
  current_daily_spend?: number,
  current_time?: Date
): EscalationResult {
  const noEscalation: EscalationResult = { escalated: false, requires_guest_action: 'approve' };

  // Check active hours — caller handles deny
  if (delegation.constraints.active_hours && current_time) {
    const timeStr = current_time.toTimeString().slice(0, 5);
    const { start, end } = delegation.constraints.active_hours;
    if (timeStr < start || timeStr > end) {
      return noEscalation;
    }
  }

  const scope = delegation.scopes.find((s) => s.action_id === action_id && s.allowed);
  if (!scope) return noEscalation;

  // Check confirmation threshold
  if (amount !== undefined && scope.requires_confirmation_above !== undefined && amount > scope.requires_confirmation_above) {
    return { escalated: true, reason: `Amount $${amount} exceeds confirmation threshold of $${scope.requires_confirmation_above}`, action_id, amount, requires_guest_action: 'approve' };
  }

  // Check per-action daily limit
  if (amount !== undefined && scope.max_amount_per_day !== undefined && current_daily_spend !== undefined) {
    if (current_daily_spend + amount > scope.max_amount_per_day) {
      return { escalated: true, reason: `Would bring daily spend for ${action_id} to $${current_daily_spend + amount}, exceeding $${scope.max_amount_per_day} limit`, action_id, amount, requires_guest_action: 'approve' };
    }
  }

  // Check total daily spend limit
  if (amount !== undefined && current_daily_spend !== undefined) {
    if (current_daily_spend + amount > delegation.constraints.max_total_spend_per_day) {
      return { escalated: true, reason: `Would bring total daily spend to $${current_daily_spend + amount}, exceeding $${delegation.constraints.max_total_spend_per_day} limit`, action_id, amount, requires_guest_action: 'approve' };
    }
  }

  return noEscalation;
}
