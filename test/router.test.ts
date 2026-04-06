import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { ActionRouter } from '../src/router/router.js';
import { DelegationManager } from '../src/delegation/manager.js';
import { generateManifest } from '../src/manifest/generator.js';
import type { VenueConfig } from '../src/manifest/types.js';
import type { ActionHandler } from '../src/router/types.js';
import type { DelegationGrant } from '../src/delegation/types.js';

const SECRET = 'test-secret';

const config: VenueConfig = {
  venue_id: 'resort-001',
  venue_name: 'Test Resort',
  venue_type: 'resort',
  timezone: 'America/Nassau',
  currency: 'USD',
  features: {
    food_and_beverage: {
      outlets: [{
        name: 'Pool Bar',
        menu_categories: ['drinks', 'snacks'],
        hours: { open: '00:00', close: '23:59' },
        delivery_locations: ['pool', 'room'],
        max_order_amount: 200,
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

const foodHandler: ActionHandler = async (params) => ({
  success: true,
  result: { order_id: 'ORD-001', items: params.items, estimated_delivery: '15-20 minutes' },
});

const housekeepingHandler: ActionHandler = async (params) => ({
  success: true,
  result: { request_id: 'HK-001', service: params.service, estimated_arrival: '10-15 minutes' },
});

const conciergeHandler: ActionHandler = async (params) => ({
  success: true,
  result: { response: `Here is information about: ${params.query}` },
});

function makeGrant(): DelegationGrant {
  return {
    guest_id: 'guest-001',
    agent_id: 'agent-001',
    venue_id: 'resort-001',
    scopes: [
      { action_id: 'order_food_pool_bar', allowed: true, max_amount_per_transaction: 100, max_amount_per_day: 300, requires_confirmation_above: 80 },
      { action_id: 'request_housekeeping', allowed: true },
      { action_id: 'concierge_query', allowed: true },
    ],
    constraints: { max_total_spend_per_day: 500 },
    duration_hours: 72,
  };
}

describe('ActionRouter', () => {
  let router: ActionRouter;
  let delegationManager: DelegationManager;
  let token: string;

  beforeEach(() => {
    const manifest = generateManifest(config);
    delegationManager = new DelegationManager({ secret: SECRET });
    const handlers = new Map<string, ActionHandler>();
    handlers.set('order_food_pool_bar', foodHandler);
    handlers.set('request_housekeeping', housekeepingHandler);
    handlers.set('concierge_query', conciergeHandler);
    router = new ActionRouter({ manifest, delegationManager, handlers });
    const grant = delegationManager.grant(makeGrant());
    token = grant.token;
  });

  it('returns success for valid in-scope request', async () => {
    const response = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_pool_bar',
      parameters: { items: 'Lobster Roll', delivery_location: 'pool', amount: 45 },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('success');
    expect(response.result).toBeDefined();
  });

  it('returns denied for out-of-scope request', async () => {
    const response = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'book_spa',
      parameters: { service: 'Massage', datetime: '2026-04-07T14:00:00Z', amount: 80 },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('denied');
  });

  it('returns escalation_required when scope limit exceeded', async () => {
    const response = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_pool_bar',
      parameters: { items: 'Expensive Platter', delivery_location: 'pool', amount: 90 },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('escalation_required');
    expect(response.escalation).toBeDefined();
  });

  it('returns not_found for unknown action_id', async () => {
    const dm = new DelegationManager({ secret: SECRET });
    const grant = dm.grant({
      ...makeGrant(),
      scopes: [...makeGrant().scopes, { action_id: 'nonexistent_action', allowed: true }],
    });
    const manifest = generateManifest(config);
    const handlers = new Map<string, ActionHandler>();
    const r = new ActionRouter({ manifest, delegationManager: dm, handlers });
    const response = await r.execute({
      request_id: uuidv4(), delegation_token: grant.token, action_id: 'nonexistent_action',
      parameters: {}, timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('not_found');
  });

  it('returns error for missing required parameters', async () => {
    const response = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_pool_bar',
      parameters: { amount: 20 },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('error');
    expect(response.error?.message).toContain('items');
  });

  it('returns error for parameter type mismatch', async () => {
    const response = await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_pool_bar',
      parameters: { items: 'Burger', delivery_location: 'pool', amount: 'not-a-number' },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('error');
    expect(response.error?.message).toContain('number');
  });

  it('creates audit entry for every request regardless of outcome', async () => {
    await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'concierge_query',
      parameters: { query: 'Where is the pool?' }, timestamp: new Date().toISOString(),
    });
    await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'book_spa',
      parameters: { service: 'Massage', datetime: '2026-04-07T14:00:00Z', amount: 80 },
      timestamp: new Date().toISOString(),
    });
    const entries = router.getAuditLog().export();
    expect(entries).toHaveLength(2);
    expect(entries[0].status).toBe('success');
    expect(entries[1].status).toBe('denied');
  });

  it('audit summary counts are correct after mixed requests', async () => {
    await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'order_food_pool_bar',
      parameters: { items: 'Beer', delivery_location: 'pool', amount: 12 },
      timestamp: new Date().toISOString(),
    });
    await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'request_housekeeping',
      parameters: { service: 'towels', location: 'Room 412' },
      timestamp: new Date().toISOString(),
    });
    await router.execute({
      request_id: uuidv4(), delegation_token: token, action_id: 'book_spa',
      parameters: { amount: 100 }, timestamp: new Date().toISOString(),
    });
    const summary = router.getAuditLog().summary();
    expect(summary.total_requests).toBe(3);
    expect(summary.by_status['success']).toBe(2);
    expect(summary.by_status['denied']).toBe(1);
  });
});
