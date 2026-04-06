# Architecture

## Overview

The Agent Gateway SDK has three modules that compose into a request pipeline:

```
Agent Request → [Token Verification] → [Delegation Check] → [Manifest Validation] → [Handler Execution] → [Audit Log] → Response
```

## Modules

### 1. Manifest — Capability Discovery

The manifest describes what a venue supports. Generated from a simplified VenueConfig and validated against a JSON Schema. Agents read the manifest to discover available actions.

Flow: `VenueConfig → generateManifest() → VenueManifest → validateManifest()`

### 2. Delegation — Authorization

Handles the guest→agent permission lifecycle. A guest grants scoped permissions; the SDK issues a JWT token. Every request is checked against the delegation for scope, spending limits, and time constraints.

Flow: `DelegationGrant → manager.grant() → JWT Token → manager.check() on each request`

### 3. Router — Action Execution

Orchestrates the pipeline. Verifies the token, checks delegation scope, validates parameters against the manifest, routes to a registered handler, records the transaction, and logs everything to the audit trail.

Flow: `ActionRequest → router.execute() → ActionResponse`

## Data Flow

```
Guest grants delegation → DelegationManager issues JWT
Agent discovers capabilities → GET /manifest
Agent acts on behalf of guest → POST /action with JWT
  → Router verifies JWT
  → Router checks delegation scope
  → Router validates parameters against manifest
  → Router calls registered handler
  → Router records transaction amount
  → Router logs to audit
  → Router returns ActionResponse
```

## Storage

All state is in-memory. The SDK is an embeddable library — the integrating platform provides persistence. Maps used:

- `DelegationManager.delegations`: `Map<delegation_id, Delegation>`
- `DelegationManager.dailySpend`: `Map<delegation_id, Map<action_id, number>>`
- `AuditLog.entries`: `AuditEntry[]`
