import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { generateManifest } from '../src/manifest/generator.js';
import { DelegationManager } from '../src/delegation/manager.js';
import { ActionRouter } from '../src/router/router.js';
import type { VenueConfig } from '../src/manifest/types.js';
import type { ActionHandler } from '../src/router/types.js';
import type { DelegationGrant } from '../src/delegation/types.js';

const SECRET = 'integration-test-secret';

const config: VenueConfig = {
  venue_id: 'test-resort',
  venue_name: 'Test Resort',
  venue_type: 'resort',
  timezone: 'America/Nassau',
  currency: 'USD',
  features: {
    food_and_beverage: {
      outlets: [{
        name: 'Cafe',
        menu_categories: ['coffee', 'pastries'],
        hours: { open: '00:00', close: '23:59' },
        delivery_locations: ['lobby', 'room'],
        max_order_amount: 100,
      }],
    },
    housekeeping: {
      services: ['towels', 'cleaning'],
      hours: { open: '00:00', close: '23:59' },
    },
    concierge: {
      capabilities: ['directions', 'information'],
    },
  },
  constraints: {
    max_transaction_amount: 500,
    daily_transaction_limit: 1000,
    supported_currencies: ['USD'],
    timezone: 'America/Nassau',
  },
};

const cafeHandler: ActionHandler = async (params) => ({
  success: true,
  result: { order_id: `ORD-${Date.now()}`, items: params.items },
});

const hkHandler: ActionHandler = async (params) => ({
  success: true,
  result: { service: params.service, status: 'dispatched' },
});

const conciergeHandler: ActionHandler = async (params) => ({
  success: true,
  result: { response: `Info about ${params.query}` },
});

function buildRouter(dm?: DelegationManager) {
  const manifest = generateManifest(config);
  const delegationManager = dm ?? new DelegationManager({ secret: SECRET });
  const handlers = new Map<string, ActionHandler>();
  handlers.set('order_food_cafe', cafeHandler);
  handlers.set('request_housekeeping', hkHandler);
  handlers.set('concierge_query', conciergeHandler);
  return { router: new ActionRouter({ manifest, delegationManager, handlers }), delegationManager };
}

function makeGrant(overrides?: Partial<DelegationGrant>): DelegationGrant {
  return {
    guest_id: 'guest-001',
    agent_id: 'agent-001',
    venue_id: 'test-resort',
    scopes: [
      { action_id: 'order_food_cafe', allowed: true, max_amount_per_transaction: 50, max_amount_per_day: 100, requires_confirmation_above: 40 },
      { action_id: 'request_housekeeping', allowed: true },
      { action_id: 'concierge_query', allowed: true },
    ],
    constraints: { max_total_spend_per_day: 200 },
    duration_hours: 72,
    ...overrides,
  };
}

describe('Integration: full flow', () => {
  it('generate manifest → grant delegation → execute actions → verify audit', async () => {
    const { router, delegationManager } = buildRouter();
    const { token } = delegationManager.grant(makeGrant());

    const r1 = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_cafe',
      parameters: { items: 'Latte', delivery_location: 'lobby', amount: 8 },
      timestamp: new Date().toISOString(),
    });
    expect(r1.status).toBe('success');

    const r2 = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'request_housekeeping',
      parameters: { service: 'towels', location: 'Room 101' },
      timestamp: new Date().toISOString(),
    });
    expect(r2.status).toBe('success');

    const summary = router.getAuditLog().summary();
    expect(summary.total_requests).toBe(2);
    expect(summary.by_status['success']).toBe(2);
    expect(summary.total_amount).toBe(8);
  });

  it('multiple guests with different delegations are isolated', async () => {
    const dm = new DelegationManager({ secret: SECRET });
    const { router } = buildRouter(dm);

    const g1 = dm.grant(makeGrant({ guest_id: 'guest-A' }));
    const g2 = dm.grant(makeGrant({
      guest_id: 'guest-B',
      scopes: [{ action_id: 'concierge_query', allowed: true }],
    }));

    const r1 = await router.execute({
      request_id: uuidv4(), delegation_token: g1.token, action_id: 'order_food_cafe',
      parameters: { items: 'Coffee', delivery_location: 'lobby', amount: 5 },
      timestamp: new Date().toISOString(),
    });
    expect(r1.status).toBe('success');

    const r2 = await router.execute({
      request_id: uuidv4(), delegation_token: g2.token, action_id: 'order_food_cafe',
      parameters: { items: 'Coffee', delivery_location: 'lobby', amount: 5 },
      timestamp: new Date().toISOString(),
    });
    expect(r2.status).toBe('denied');
  });

  it('spending limits accumulate correctly across transactions', async () => {
    const { router, delegationManager } = buildRouter();
    const { token } = delegationManager.grant(makeGrant());

    // $30 (under $40 threshold)
    const r1 = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_cafe',
      parameters: { items: 'Sandwich', delivery_location: 'lobby', amount: 30 },
      timestamp: new Date().toISOString(),
    });
    expect(r1.status).toBe('success');

    // $30 more (under $40 threshold, $60 total of $100 daily)
    const r2 = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_cafe',
      parameters: { items: 'Salad', delivery_location: 'room', amount: 30 },
      timestamp: new Date().toISOString(),
    });
    expect(r2.status).toBe('success');

    // $39 more ($99 total, still under $100) — under threshold too
    const r3 = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_cafe',
      parameters: { items: 'Big Meal', delivery_location: 'room', amount: 39 },
      timestamp: new Date().toISOString(),
    });
    expect(r3.status).toBe('success');

    // $10 more → $109, over $100 daily → escalation
    const r4 = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_cafe',
      parameters: { items: 'Snack', delivery_location: 'lobby', amount: 10 },
      timestamp: new Date().toISOString(),
    });
    expect(r4.status).toBe('escalation_required');
  });

  it('escalation → approval → retry flow works end-to-end', async () => {
    const dm = new DelegationManager({ secret: SECRET });
    const { router } = buildRouter(dm);
    const { token, delegation } = dm.grant(makeGrant());

    // $45 > $40 threshold → escalation
    const r1 = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_cafe',
      parameters: { items: 'Premium Lunch', delivery_location: 'room', amount: 45 },
      timestamp: new Date().toISOString(),
    });
    expect(r1.status).toBe('escalation_required');
    expect(r1.escalation?.escalated).toBe(true);

    // Simulate guest approval by raising threshold
    const scope = delegation.scopes.find((s) => s.action_id === 'order_food_cafe')!;
    scope.requires_confirmation_above = 500;

    // Retry — now passes
    const r2 = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_cafe',
      parameters: { items: 'Premium Lunch', delivery_location: 'room', amount: 45 },
      timestamp: new Date().toISOString(),
    });
    expect(r2.status).toBe('success');
  });
});
