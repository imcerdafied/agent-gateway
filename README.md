# Agent Gateway SDK

A TypeScript SDK for AI agents to interact with physical venue platforms on behalf of guests.

## Quick Start

```bash
npm install
npm test
npm run demo
```

## What It Does

Three modules compose into a pipeline:

1. **Manifest** — Machine-readable venue capability discovery
2. **Delegation** — Guest-to-agent authorization with scoped permissions
3. **Router** — Action validation, routing, and audit logging

## Demo

Run the interactive demo to see the full flow:

```bash
npx tsx demo/run-demo.ts
```

Shows an AI travel assistant acting on behalf of a resort guest: ordering food, requesting housekeeping, asking the concierge, hitting spending limits, and getting denied for out-of-scope actions.

## Usage

```typescript
import {
  generateManifest,
  DelegationManager,
  ActionRouter,
} from '@agent-gateway/sdk';

// 1. Generate a manifest from your venue config
const manifest = generateManifest(venueConfig);

// 2. Create a delegation manager
const delegationManager = new DelegationManager({ secret: 'your-secret' });

// 3. Grant a delegation (guest authorizes their agent)
const { token } = delegationManager.grant({
  guest_id: 'guest-123',
  agent_id: 'agent-456',
  venue_id: 'venue-789',
  scopes: [{ action_id: 'order_food', allowed: true, max_amount_per_transaction: 100 }],
  constraints: { max_total_spend_per_day: 500 },
  duration_hours: 24,
});

// 4. Create a router with handlers
const router = new ActionRouter({
  manifest,
  delegationManager,
  handlers: new Map([['order_food', yourFoodHandler]]),
});

// 5. Execute agent actions
const response = await router.execute({
  request_id: 'req-001',
  delegation_token: token,
  action_id: 'order_food',
  parameters: { items: 'Coffee', amount: 5 },
  timestamp: new Date().toISOString(),
});
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## API Reference

### Manifest
- `generateManifest(config: VenueConfig): VenueManifest`
- `validateManifest(manifest: unknown): ValidationResult`

### Delegation
- `DelegationManager.grant(request): { delegation, token }`
- `DelegationManager.check(token, action_id, amount?): CheckResult`
- `DelegationManager.revoke(delegation_id): void`
- `DelegationManager.recordTransaction(delegation_id, action_id, amount): void`

### Router
- `ActionRouter.execute(request: ActionRequest): Promise<ActionResponse>`
- `ActionRouter.getAuditLog(): AuditLog`

### Audit
- `AuditLog.query(filters): AuditEntry[]`
- `AuditLog.summary(): AuditSummary`
- `AuditLog.export(): AuditEntry[]`
