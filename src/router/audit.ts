import type { AuditEntry, ActionResponse } from './types.js';

export class AuditLog {
  private entries: AuditEntry[] = [];

  append(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  query(filters: {
    guest_id?: string;
    agent_id?: string;
    action_id?: string;
    status?: ActionResponse['status'];
    from?: string;
    to?: string;
  }): AuditEntry[] {
    return this.entries.filter((entry) => {
      if (filters.guest_id && entry.guest_id !== filters.guest_id) return false;
      if (filters.agent_id && entry.agent_id !== filters.agent_id) return false;
      if (filters.action_id && entry.action_id !== filters.action_id) return false;
      if (filters.status && entry.status !== filters.status) return false;
      if (filters.from && entry.timestamp < filters.from) return false;
      if (filters.to && entry.timestamp > filters.to) return false;
      return true;
    });
  }

  export(): AuditEntry[] {
    return [...this.entries];
  }

  summary(): {
    total_requests: number;
    by_status: Record<string, number>;
    by_action: Record<string, number>;
    total_amount: number;
    escalations: number;
  } {
    const by_status: Record<string, number> = {};
    const by_action: Record<string, number> = {};
    let total_amount = 0;
    let escalations = 0;
    for (const entry of this.entries) {
      by_status[entry.status] = (by_status[entry.status] ?? 0) + 1;
      by_action[entry.action_id] = (by_action[entry.action_id] ?? 0) + 1;
      if (entry.amount) total_amount += entry.amount;
      if (entry.escalation?.escalated) escalations++;
    }
    return { total_requests: this.entries.length, by_status, by_action, total_amount, escalations };
  }
}
