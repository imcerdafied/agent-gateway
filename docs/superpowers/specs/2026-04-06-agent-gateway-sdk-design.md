# Agent Gateway SDK — Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Type:** Greenfield SDK

## Summary

A TypeScript SDK providing infrastructure for AI agents to interact with physical venue platforms (hotels, resorts, cruise ships, airports) on behalf of guests. Three modules: capability discovery (manifest), guest-to-agent delegation, and action routing with audit. Plus a working CLI demo.

**What this is:** An embeddable library. NOT a hosted service, UI, or SaaS product.
**First integration target:** Phunware hospitality platform (but SDK is venue-agnostic).
**Target:** Buildable in ~5 days. Working demo runnable from CLI, showable to a non-technical board member in under 3 minutes.

## Architecture

```
agent-gateway/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                       # Public API exports
│   ├── manifest/
│   │   ├── types.ts                   # VenueManifest, Action, Parameter, Constraint types
│   │   ├── schema.ts                  # JSON Schema definition for manifest validation
│   │   ├── generator.ts               # Takes a venue config, outputs a valid manifest
│   │   └── validator.ts               # Validates a manifest against the schema
│   ├── delegation/
│   │   ├── types.ts                   # Delegation, Scope, EscalationRule types
│   │   ├── manager.ts                 # DelegationManager class: grant, check, revoke, expire
│   │   ├── token.ts                   # JWT-based delegation tokens: sign, verify, decode
│   │   └── escalation.ts             # Escalation logic: when an action exceeds scope
│   ├── router/
│   │   ├── types.ts                   # ActionRequest, ActionResponse, AuditEntry types
│   │   ├── router.ts                  # ActionRouter class: validate, route, respond
│   │   ├── handlers.ts               # Handler registry: map action types to handler functions
│   │   └── audit.ts                  # AuditLog class: append, query, export
│   └── errors.ts                      # Typed error classes for the SDK
├── demo/
│   ├── venue-config.ts               # Sample resort configuration
│   ├── handlers/
│   │   ├── food-order.ts
│   │   ├── spa-booking.ts
│   │   ├── housekeeping.ts
│   │   └── concierge-query.ts
│   ├── server.ts                      # Express server using the SDK
│   ├── agent.ts                       # Simulated AI agent
│   └── run-demo.ts                   # Orchestrates end-to-end demo
├── test/
│   ├── manifest.test.ts
│   ├── delegation.test.ts
│   ├── router.test.ts
│   └── integration.test.ts
└── docs/
    ├── ARCHITECTURE.md
    ├── MANIFEST_SPEC.md
    └── DELEGATION_PROTOCOL.md
```

## Module 1: Capability Manifest

Machine-readable description of venue capabilities. Think OpenAPI for physical venues. An agent reads the manifest and knows: available actions, required parameters, constraints, and authentication.

### Key Types
- `VenueManifest` — top-level document with venue info, capabilities, auth, constraints
- `ActionCapability` — individual action with params, constraints, confirmation requirements
- `ActionParameter` — typed parameter with validation rules
- `ActionConstraint` — hours, limits, location, advance notice
- `VenueConfig` — simplified input format that hotel operators fill out

### Generator
Takes a `VenueConfig`, outputs a `VenueManifest`. Deterministic: same config in, same manifest out. Each enabled feature block produces one or more ActionCapability entries.

### Validator
Uses `ajv` for JSON Schema validation. Schema defined explicitly in `schema.ts` for portability to non-TypeScript consumers.

## Module 2: Delegation Manager

Authorization lifecycle: guest grants agent permission to act on their behalf, scoped to specific actions and constrained by limits.

### Key Types
- `Delegation` — the authorization record (guest, agent, venue, scopes, status)
- `DelegationScope` — per-action permissions with spending caps and confirmation thresholds
- `DelegationConstraints` — cross-action limits (daily spend, hours, locations)
- `DelegationGrant` — request to create a delegation

### DelegationManager
- `grant()` — create delegation, return signed JWT token
- `check()` — validate token + check if specific action is permitted (sync, hot path)
- `revoke()` — cancel a delegation
- `listForGuest()` — all active delegations for a guest
- `recordTransaction()` — track spend against daily limits

### Token
JWT-based (HS256, `jsonwebtoken`). Token encodes delegation_id, guest_id, agent_id, venue_id, scope_ids, expiry. Full delegation details stored in DelegationManager's internal Map.

### Escalation Triggers
1. Amount exceeds `requires_confirmation_above` for scope → escalate
2. Daily spend would exceed per-action `max_amount_per_day` → escalate
3. Total daily spend would exceed `max_total_spend_per_day` → escalate
4. Action's `requires_guest_confirmation` is true → always escalate
5. Outside `active_hours` → deny (not escalate)
6. Action not in scoped action_ids → deny (not escalate)

## Module 3: Action Router

Validates delegation, checks manifest, routes to handler, logs everything. Glue between modules 1 and 2.

### Execute Flow
1. Verify delegation token (JWT)
2. Check delegation scope (DelegationManager.check)
3. Validate against manifest (action exists, params valid, constraints met)
4. Route to handler
5. Record transaction (if amount)
6. Log to audit (always, regardless of outcome)
7. Return response

### Audit Log
In-memory, append-only. Supports query with filters and summary (counts by status, by action, total amount, escalations).

## Demo

Resort with 3 F&B outlets, spa, housekeeping, concierge, 2 activities. Express server exposing SDK via HTTP. Agent simulator walks through 8 steps: discover, delegate, 3 successes, 1 escalation, 1 denial, 1 limit hit. Formatted output with chalk, readable by non-technical audience.

## Design Principles
1. Zero infrastructure (in-memory everything)
2. Sync by default, async where necessary
3. Typed everything (no `any` except where noted)
4. Manifest is the contract
5. Delegation is the security boundary
6. Audit everything
7. Demo is the product

## Dependencies
- Runtime: jsonwebtoken, uuid, ajv, express (demo only)
- Dev: typescript, vitest, @types/*, chalk, tsx
