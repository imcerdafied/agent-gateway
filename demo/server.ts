import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateManifest } from '../src/manifest/generator.js';
import { DelegationManager } from '../src/delegation/manager.js';
import { ActionRouter } from '../src/router/router.js';
import { resortConfig } from './venue-config.js';
import { foodOrderHandler } from './handlers/food-order.js';
import { spaBookingHandler } from './handlers/spa-booking.js';
import { housekeepingHandler } from './handlers/housekeeping.js';
import { conciergeQueryHandler } from './handlers/concierge-query.js';

export function createServer() {
  const app = express();
  app.use(express.json());

  const manifest = generateManifest(resortConfig);
  const delegationManager = new DelegationManager();

  const handlers = new Map();
  // Register food handlers for all 3 outlets
  handlers.set('order_food_pool_bar', foodOrderHandler);
  handlers.set('order_food_ocean_grill', foodOrderHandler);
  handlers.set('order_food_the_steakhouse', foodOrderHandler);
  handlers.set('book_spa', spaBookingHandler);
  handlers.set('request_housekeeping', housekeepingHandler);
  handlers.set('concierge_query', conciergeQueryHandler);

  const router = new ActionRouter({ manifest, delegationManager, handlers });

  // GET /manifest
  app.get('/manifest', (_req, res) => {
    res.json(manifest);
  });

  // POST /delegate
  app.post('/delegate', (req, res) => {
    try {
      const result = delegationManager.grant(req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to grant delegation' });
    }
  });

  // POST /delegate/:id/revoke
  app.post('/delegate/:id/revoke', (req, res) => {
    try {
      delegationManager.revoke(req.params.id);
      res.json({ revoked: true });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Delegation not found' });
    }
  });

  // GET /delegate/:id
  app.get('/delegate/:id', (req, res) => {
    const delegation = delegationManager.get(req.params.id);
    if (!delegation) {
      res.status(404).json({ error: 'Delegation not found' });
      return;
    }
    res.json(delegation);
  });

  // POST /action
  app.post('/action', async (req, res) => {
    const body = req.body;
    if (!body.request_id) body.request_id = uuidv4();
    if (!body.timestamp) body.timestamp = new Date().toISOString();
    try {
      const result = await router.execute(body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Action execution failed' });
    }
  });

  // GET /audit
  app.get('/audit', (req, res) => {
    const q = req.query;
    res.json(router.getAuditLog().query({
      guest_id: q.guest_id as string | undefined,
      agent_id: q.agent_id as string | undefined,
      action_id: q.action_id as string | undefined,
      status: q.status as 'success' | 'denied' | 'escalation_required' | 'error' | 'not_found' | undefined,
      from: q.from as string | undefined,
      to: q.to as string | undefined,
    }));
  });

  // GET /audit/summary
  app.get('/audit/summary', (_req, res) => {
    res.json(router.getAuditLog().summary());
  });

  return app;
}
