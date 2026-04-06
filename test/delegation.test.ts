import { describe, it, expect, beforeEach } from 'vitest';
import { DelegationManager } from '../src/delegation/manager.js';
import type { DelegationGrant } from '../src/delegation/types.js';

const SECRET = 'test-secret-key';

function makeGrant(overrides?: Partial<DelegationGrant>): DelegationGrant {
  return {
    guest_id: 'guest-001',
    agent_id: 'agent-001',
    venue_id: 'venue-001',
    scopes: [
      { action_id: 'order_food', allowed: true, max_amount_per_transaction: 100, max_amount_per_day: 300, requires_confirmation_above: 150 },
      { action_id: 'book_spa', allowed: true, max_amount_per_transaction: 500, requires_confirmation_above: 150 },
      { action_id: 'request_housekeeping', allowed: true },
      { action_id: 'concierge_query', allowed: true },
    ],
    constraints: { max_total_spend_per_day: 500 },
    duration_hours: 72,
    ...overrides,
  };
}

describe('DelegationManager', () => {
  let manager: DelegationManager;

  beforeEach(() => {
    manager = new DelegationManager({ secret: SECRET });
  });

  it('grant creates a valid delegation and returns a token', () => {
    const { delegation, token } = manager.grant(makeGrant());
    expect(delegation.delegation_id).toBeDefined();
    expect(delegation.status).toBe('active');
    expect(delegation.guest_id).toBe('guest-001');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('check permits an in-scope action', () => {
    const { token } = manager.grant(makeGrant());
    const result = manager.check(token, 'order_food', 50);
    expect(result.permitted).toBe(true);
  });

  it('check denies an out-of-scope action', () => {
    const { token } = manager.grant(makeGrant());
    const result = manager.check(token, 'book_activity', 150);
    expect(result.permitted).toBe(false);
    expect(result.reason).toContain('not in delegation scope');
  });

  it('check triggers escalation when amount exceeds confirmation threshold', () => {
    const { token } = manager.grant(makeGrant());
    const result = manager.check(token, 'book_spa', 200);
    expect(result.permitted).toBe(false);
    expect(result.escalation).toBeDefined();
    expect(result.escalation!.escalated).toBe(true);
    expect(result.escalation!.requires_guest_action).toBe('approve');
  });

  it('check triggers escalation when daily limit would be exceeded', () => {
    const { delegation, token } = manager.grant(makeGrant());
    manager.recordTransaction(delegation.delegation_id, 'order_food', 250);
    const result = manager.check(token, 'order_food', 60);
    expect(result.permitted).toBe(false);
    expect(result.escalation).toBeDefined();
    expect(result.escalation!.escalated).toBe(true);
  });

  it('check denies when per-transaction limit exceeded', () => {
    const { token } = manager.grant(makeGrant());
    const result = manager.check(token, 'order_food', 120);
    expect(result.permitted).toBe(false);
    expect(result.reason).toContain('per-transaction limit');
  });

  it('revoke sets status to revoked, subsequent checks fail', () => {
    const { delegation, token } = manager.grant(makeGrant());
    manager.revoke(delegation.delegation_id);
    const result = manager.check(token, 'order_food', 10);
    expect(result.permitted).toBe(false);
    expect(result.reason).toContain('revoked');
  });

  it('expired delegation is rejected', () => {
    const { token } = manager.grant(makeGrant({ duration_hours: 0 }));
    const result = manager.check(token, 'order_food', 10);
    expect(result.permitted).toBe(false);
  });

  it('recordTransaction updates daily spend tracking', () => {
    const { delegation, token } = manager.grant(makeGrant());
    manager.recordTransaction(delegation.delegation_id, 'order_food', 50);
    manager.recordTransaction(delegation.delegation_id, 'order_food', 30);
    const result = manager.check(token, 'order_food', 230);
    expect(result.permitted).toBe(false);
    expect(result.escalation?.escalated).toBe(true);
  });

  it('listForGuest returns only active delegations for that guest', () => {
    manager.grant(makeGrant({ guest_id: 'guest-001' }));
    manager.grant(makeGrant({ guest_id: 'guest-001' }));
    manager.grant(makeGrant({ guest_id: 'guest-002' }));
    const { delegation } = manager.grant(makeGrant({ guest_id: 'guest-001' }));
    manager.revoke(delegation.delegation_id);
    const list = manager.listForGuest('guest-001');
    expect(list).toHaveLength(2);
    expect(list.every((d) => d.guest_id === 'guest-001')).toBe(true);
    expect(list.every((d) => d.status === 'active')).toBe(true);
  });
});
