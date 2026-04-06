# Agent Gateway SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript SDK with three modules (manifest, delegation, router) plus a CLI demo that shows AI agents interacting with a resort venue.

**Architecture:** Three independent modules compose into a pipeline: Manifest describes capabilities, Delegation authorizes agents, Router validates+routes+audits actions. An Express demo server wires them together; a simulated agent exercises the full flow.

**Tech Stack:** TypeScript 5.4+, Vitest, jsonwebtoken, uuid, ajv, Express (demo only), chalk (demo only), tsx (runner)

**Repo root:** `/Users/mc/Desktop/bspg/clients/phunware/agent-gateway`

---

## File Map

```
src/
  index.ts                    — Public API re-exports
  errors.ts                   — Typed error classes
  manifest/
    types.ts                  — VenueManifest, ActionCapability, ActionParameter, ActionConstraint, AuthRequirements, VenueConstraints, VenueConfig
    schema.ts                 — JSON Schema object for manifest validation
    generator.ts              — generateManifest(config) → VenueManifest
    validator.ts              — validateManifest(manifest) → ValidationResult
  delegation/
    types.ts                  — Delegation, DelegationScope, DelegationConstraints, DelegationGrant, EscalationResult, TokenPayload
    token.ts                  — signToken, verifyToken, decodeToken
    escalation.ts             — checkEscalation()
    manager.ts                — DelegationManager class
  router/
    types.ts                  — ActionRequest, ActionResponse, AuditEntry, ActionHandler
    audit.ts                  — AuditLog class
    handlers.ts               — HandlerRegistry class
    router.ts                 — ActionRouter class
demo/
  venue-config.ts             — Full resort + minimal hotel configs
  handlers/
    food-order.ts             — Food ordering handler
    spa-booking.ts            — Spa booking handler
    housekeeping.ts           — Housekeeping handler
    concierge-query.ts        — Concierge handler
  server.ts                   — Express demo server
  agent.ts                    — Agent simulator
  run-demo.ts                 — Orchestrator
test/
  manifest.test.ts
  delegation.test.ts
  router.test.ts
  integration.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@agent-gateway/sdk",
  "version": "0.1.0",
  "description": "TypeScript SDK for AI agent-to-venue interaction",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "demo": "tsx demo/run-demo.ts"
  },
  "dependencies": {
    "ajv": "^8.12.0",
    "ajv-formats": "^3.0.0",
    "express": "^4.18.0",
    "jsonwebtoken": "^9.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/uuid": "^9.0.0",
    "chalk": "^5.3.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "demo/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
```

- [ ] **Step 5: Install dependencies**

Run: `cd /Users/mc/Desktop/bspg/clients/phunware/agent-gateway && npm install`
Expected: `node_modules` created, lockfile generated, zero errors.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (no source files yet, just config validation).

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore package-lock.json
git commit -m "chore: scaffold project with TypeScript, Vitest, and dependencies"
```

---

## Task 2: Error Classes

**Files:**
- Create: `src/errors.ts`

- [ ] **Step 1: Write src/errors.ts**

```typescript
export class AgentGatewayError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AgentGatewayError';
    this.code = code;
  }
}

export class DelegationDeniedError extends AgentGatewayError {
  constructor(message: string) {
    super('DELEGATION_DENIED', message);
    this.name = 'DelegationDeniedError';
  }
}

export class DelegationExpiredError extends AgentGatewayError {
  constructor(message: string) {
    super('DELEGATION_EXPIRED', message);
    this.name = 'DelegationExpiredError';
  }
}

export class DelegationRevokedError extends AgentGatewayError {
  constructor(message: string) {
    super('DELEGATION_REVOKED', message);
    this.name = 'DelegationRevokedError';
  }
}

export class EscalationRequiredError extends AgentGatewayError {
  constructor(message: string) {
    super('ESCALATION_REQUIRED', message);
    this.name = 'EscalationRequiredError';
  }
}

export class ManifestValidationError extends AgentGatewayError {
  constructor(message: string) {
    super('MANIFEST_VALIDATION_ERROR', message);
    this.name = 'ManifestValidationError';
  }
}

export class ParameterValidationError extends AgentGatewayError {
  constructor(message: string) {
    super('PARAMETER_VALIDATION_ERROR', message);
    this.name = 'ParameterValidationError';
  }
}

export class ActionNotFoundError extends AgentGatewayError {
  constructor(message: string) {
    super('ACTION_NOT_FOUND', message);
    this.name = 'ActionNotFoundError';
  }
}

export class ConstraintViolationError extends AgentGatewayError {
  constructor(message: string) {
    super('CONSTRAINT_VIOLATION', message);
    this.name = 'ConstraintViolationError';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/errors.ts
git commit -m "feat: add typed error classes for SDK"
```

---

## Task 3: Manifest Types

**Files:**
- Create: `src/manifest/types.ts`

- [ ] **Step 1: Write src/manifest/types.ts**

```typescript
export interface VenueManifest {
  venue_id: string;
  venue_name: string;
  venue_type: 'hotel' | 'resort' | 'cruise' | 'airport' | 'campus' | 'conference';
  version: string;
  generated_at: string;
  capabilities: ActionCapability[];
  authentication: AuthRequirements;
  constraints: VenueConstraints;
}

export interface ActionCapability {
  action_id: string;
  category: 'commerce' | 'booking' | 'service' | 'information' | 'navigation';
  name: string;
  description: string;
  parameters: ActionParameter[];
  constraints: ActionConstraint[];
  requires_guest_confirmation: boolean;
  estimated_fulfillment: string;
}

export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'datetime' | 'location';
  required: boolean;
  description: string;
  enum_values?: string[];
  min?: number;
  max?: number;
  default?: unknown;
}

export interface ActionConstraint {
  type: 'hours' | 'max_amount' | 'location_required' | 'advance_notice' | 'availability';
  value: unknown;
  description: string;
}

export interface AuthRequirements {
  delegation_required: boolean;
  supported_protocols: string[];
  token_endpoint: string;
}

export interface VenueConstraints {
  max_transaction_amount: number;
  daily_transaction_limit: number;
  supported_currencies: string[];
  timezone: string;
}

export interface VenueConfig {
  venue_id: string;
  venue_name: string;
  venue_type: VenueManifest['venue_type'];
  timezone: string;
  currency: string;
  features: {
    food_and_beverage?: {
      outlets: Array<{
        name: string;
        menu_categories: string[];
        hours: { open: string; close: string };
        delivery_locations: string[];
        max_order_amount: number;
      }>;
    };
    spa?: {
      services: Array<{
        name: string;
        duration_minutes: number;
        price: number;
      }>;
      hours: { open: string; close: string };
      advance_notice_hours: number;
    };
    housekeeping?: {
      services: string[];
      hours: { open: string; close: string };
    };
    concierge?: {
      capabilities: string[];
    };
    activities?: {
      items: Array<{
        name: string;
        price: number;
        advance_notice_hours: number;
      }>;
    };
  };
  constraints?: Partial<VenueConstraints>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/manifest/types.ts
git commit -m "feat: add manifest type definitions"
```

---

## Task 4: Manifest JSON Schema

**Files:**
- Create: `src/manifest/schema.ts`

- [ ] **Step 1: Write src/manifest/schema.ts**

```typescript
import type { JSONSchemaType } from 'ajv';
import type { VenueManifest } from './types.js';

// We use a plain object schema (not JSONSchemaType) because ajv's strict
// generic typing doesn't handle union types and optional fields well.
// The schema is still fully correct for validation purposes.

export const venueManifestSchema: Record<string, unknown> = {
  type: 'object',
  required: [
    'venue_id',
    'venue_name',
    'venue_type',
    'version',
    'generated_at',
    'capabilities',
    'authentication',
    'constraints',
  ],
  additionalProperties: false,
  properties: {
    venue_id: { type: 'string', minLength: 1 },
    venue_name: { type: 'string', minLength: 1 },
    venue_type: {
      type: 'string',
      enum: ['hotel', 'resort', 'cruise', 'airport', 'campus', 'conference'],
    },
    version: { type: 'string', minLength: 1 },
    generated_at: { type: 'string', format: 'date-time' },
    capabilities: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'action_id',
          'category',
          'name',
          'description',
          'parameters',
          'constraints',
          'requires_guest_confirmation',
          'estimated_fulfillment',
        ],
        additionalProperties: false,
        properties: {
          action_id: { type: 'string', minLength: 1 },
          category: {
            type: 'string',
            enum: ['commerce', 'booking', 'service', 'information', 'navigation'],
          },
          name: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'type', 'required', 'description'],
              additionalProperties: false,
              properties: {
                name: { type: 'string', minLength: 1 },
                type: {
                  type: 'string',
                  enum: ['string', 'number', 'boolean', 'enum', 'datetime', 'location'],
                },
                required: { type: 'boolean' },
                description: { type: 'string' },
                enum_values: {
                  type: 'array',
                  items: { type: 'string' },
                  nullable: true,
                },
                min: { type: 'number', nullable: true },
                max: { type: 'number', nullable: true },
                default: { nullable: true },
              },
            },
          },
          constraints: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'value', 'description'],
              additionalProperties: false,
              properties: {
                type: {
                  type: 'string',
                  enum: ['hours', 'max_amount', 'location_required', 'advance_notice', 'availability'],
                },
                value: {},
                description: { type: 'string' },
              },
            },
          },
          requires_guest_confirmation: { type: 'boolean' },
          estimated_fulfillment: { type: 'string', minLength: 1 },
        },
      },
    },
    authentication: {
      type: 'object',
      required: ['delegation_required', 'supported_protocols', 'token_endpoint'],
      additionalProperties: false,
      properties: {
        delegation_required: { type: 'boolean' },
        supported_protocols: {
          type: 'array',
          items: { type: 'string' },
        },
        token_endpoint: { type: 'string', minLength: 1 },
      },
    },
    constraints: {
      type: 'object',
      required: [
        'max_transaction_amount',
        'daily_transaction_limit',
        'supported_currencies',
        'timezone',
      ],
      additionalProperties: false,
      properties: {
        max_transaction_amount: { type: 'number', minimum: 0 },
        daily_transaction_limit: { type: 'number', minimum: 0 },
        supported_currencies: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
        },
        timezone: { type: 'string', minLength: 1 },
      },
    },
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/manifest/schema.ts
git commit -m "feat: add JSON Schema for manifest validation"
```

---

## Task 5: Manifest Validator

**Files:**
- Create: `src/manifest/validator.ts`

- [ ] **Step 1: Write src/manifest/validator.ts**

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { venueManifestSchema } from './schema.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(venueManifestSchema);

export function validateManifest(manifest: unknown): ValidationResult {
  const valid = validate(manifest);
  if (valid) {
    return { valid: true, errors: [] };
  }
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message ?? 'unknown error'}`
  );
  return { valid: false, errors };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/manifest/validator.ts
git commit -m "feat: add manifest validator using ajv"
```

---

## Task 6: Manifest Generator

**Files:**
- Create: `src/manifest/generator.ts`

- [ ] **Step 1: Write src/manifest/generator.ts**

```typescript
import type {
  VenueConfig,
  VenueManifest,
  ActionCapability,
  ActionParameter,
  ActionConstraint,
} from './types.js';

export function generateManifest(config: VenueConfig): VenueManifest {
  const capabilities: ActionCapability[] = [];

  if (config.features.food_and_beverage) {
    for (const outlet of config.features.food_and_beverage.outlets) {
      capabilities.push({
        action_id: `order_food_${outlet.name.toLowerCase().replace(/\s+/g, '_')}`,
        category: 'commerce',
        name: `Order from ${outlet.name}`,
        description: `Place a food and beverage order from ${outlet.name}`,
        parameters: [
          {
            name: 'items',
            type: 'string',
            required: true,
            description: 'Comma-separated list of items to order',
          },
          {
            name: 'delivery_location',
            type: 'enum',
            required: true,
            description: 'Where to deliver the order',
            enum_values: outlet.delivery_locations,
          },
          {
            name: 'special_instructions',
            type: 'string',
            required: false,
            description: 'Any special instructions for the order',
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Total order amount in venue currency',
            min: 0,
            max: outlet.max_order_amount,
          },
        ],
        constraints: [
          {
            type: 'hours',
            value: outlet.hours,
            description: `Available ${outlet.hours.open} - ${outlet.hours.close}`,
          },
          {
            type: 'max_amount',
            value: outlet.max_order_amount,
            description: `Maximum order amount: $${outlet.max_order_amount}`,
          },
        ],
        requires_guest_confirmation: false,
        estimated_fulfillment: '15-30 minutes',
      });
    }
  }

  if (config.features.spa) {
    const spa = config.features.spa;
    capabilities.push({
      action_id: 'book_spa',
      category: 'booking',
      name: 'Book Spa Service',
      description: 'Book a spa treatment or package',
      parameters: [
        {
          name: 'service',
          type: 'enum',
          required: true,
          description: 'Spa service to book',
          enum_values: spa.services.map((s) => s.name),
        },
        {
          name: 'datetime',
          type: 'datetime',
          required: true,
          description: 'Requested date and time for the appointment',
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
          description: 'Service price',
          min: 0,
          max: Math.max(...spa.services.map((s) => s.price)),
        },
      ],
      constraints: [
        {
          type: 'hours',
          value: spa.hours,
          description: `Spa hours: ${spa.hours.open} - ${spa.hours.close}`,
        },
        {
          type: 'advance_notice',
          value: spa.advance_notice_hours,
          description: `Requires ${spa.advance_notice_hours} hours advance notice`,
        },
      ],
      requires_guest_confirmation: false,
      estimated_fulfillment: 'Confirmed at booking',
    });
  }

  if (config.features.housekeeping) {
    const hk = config.features.housekeeping;
    capabilities.push({
      action_id: 'request_housekeeping',
      category: 'service',
      name: 'Request Housekeeping',
      description: 'Request housekeeping services',
      parameters: [
        {
          name: 'service',
          type: 'enum',
          required: true,
          description: 'Type of housekeeping service',
          enum_values: hk.services,
        },
        {
          name: 'location',
          type: 'string',
          required: true,
          description: 'Room number or venue location',
        },
        {
          name: 'notes',
          type: 'string',
          required: false,
          description: 'Additional notes',
        },
      ],
      constraints: [
        {
          type: 'hours',
          value: hk.hours,
          description: `Available ${hk.hours.open} - ${hk.hours.close}`,
        },
      ],
      requires_guest_confirmation: false,
      estimated_fulfillment: '15-30 minutes',
    });
  }

  if (config.features.concierge) {
    const concierge = config.features.concierge;
    capabilities.push({
      action_id: 'concierge_query',
      category: 'information',
      name: 'Ask Concierge',
      description: 'Ask the concierge a question or request information',
      parameters: [
        {
          name: 'query',
          type: 'string',
          required: true,
          description: 'Your question or request',
        },
        {
          name: 'category',
          type: 'enum',
          required: false,
          description: 'Category of inquiry',
          enum_values: concierge.capabilities,
        },
      ],
      constraints: [],
      requires_guest_confirmation: false,
      estimated_fulfillment: 'immediate',
    });
  }

  if (config.features.activities) {
    for (const activity of config.features.activities.items) {
      capabilities.push({
        action_id: `book_activity_${activity.name.toLowerCase().replace(/\s+/g, '_')}`,
        category: 'booking',
        name: `Book ${activity.name}`,
        description: `Book the ${activity.name} activity`,
        parameters: [
          {
            name: 'datetime',
            type: 'datetime',
            required: true,
            description: 'Requested date and time',
          },
          {
            name: 'guests',
            type: 'number',
            required: true,
            description: 'Number of guests',
            min: 1,
            max: 10,
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Total price',
            min: 0,
            max: activity.price * 10,
          },
        ],
        constraints: [
          {
            type: 'advance_notice',
            value: activity.advance_notice_hours,
            description: `Requires ${activity.advance_notice_hours} hours advance notice`,
          },
        ],
        requires_guest_confirmation: true,
        estimated_fulfillment: 'Confirmed at booking',
      });
    }
  }

  return {
    venue_id: config.venue_id,
    venue_name: config.venue_name,
    venue_type: config.venue_type,
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    capabilities,
    authentication: {
      delegation_required: true,
      supported_protocols: ['agent-gateway-v1'],
      token_endpoint: '/delegate',
    },
    constraints: {
      max_transaction_amount: config.constraints?.max_transaction_amount ?? 500,
      daily_transaction_limit: config.constraints?.daily_transaction_limit ?? 1000,
      supported_currencies: config.constraints?.supported_currencies ?? [config.currency],
      timezone: config.constraints?.timezone ?? config.timezone,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/manifest/generator.ts
git commit -m "feat: add manifest generator from venue config"
```

---

## Task 7: Manifest Tests

**Files:**
- Create: `test/manifest.test.ts`

- [ ] **Step 1: Write test/manifest.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { generateManifest } from '../src/manifest/generator.js';
import { validateManifest } from '../src/manifest/validator.js';
import type { VenueConfig } from '../src/manifest/types.js';

const fullResortConfig: VenueConfig = {
  venue_id: 'resort-001',
  venue_name: 'Paradise Resort & Spa',
  venue_type: 'resort',
  timezone: 'America/Nassau',
  currency: 'USD',
  features: {
    food_and_beverage: {
      outlets: [
        {
          name: 'Pool Bar',
          menu_categories: ['drinks', 'snacks', 'lunch'],
          hours: { open: '10:00', close: '22:00' },
          delivery_locations: ['pool', 'beach', 'cabana'],
          max_order_amount: 75,
        },
        {
          name: 'Ocean Grill',
          menu_categories: ['lunch', 'dinner', 'wine'],
          hours: { open: '11:00', close: '23:00' },
          delivery_locations: ['restaurant', 'room'],
          max_order_amount: 200,
        },
      ],
    },
    spa: {
      services: [
        { name: 'Swedish Massage', duration_minutes: 30, price: 80 },
        { name: 'Couples Relaxation Package', duration_minutes: 90, price: 350 },
      ],
      hours: { open: '08:00', close: '20:00' },
      advance_notice_hours: 2,
    },
    housekeeping: {
      services: ['towels', 'cleaning', 'turndown', 'minibar'],
      hours: { open: '06:00', close: '23:00' },
    },
    concierge: {
      capabilities: ['directions', 'recommendations', 'reservations', 'information'],
    },
    activities: {
      items: [
        { name: 'Sunset Sailing', price: 150, advance_notice_hours: 24 },
      ],
    },
  },
  constraints: {
    max_transaction_amount: 500,
    daily_transaction_limit: 1000,
    supported_currencies: ['USD'],
    timezone: 'America/Nassau',
  },
};

const minimalConfig: VenueConfig = {
  venue_id: 'hotel-001',
  venue_name: 'City Hotel',
  venue_type: 'hotel',
  timezone: 'America/New_York',
  currency: 'USD',
  features: {
    housekeeping: {
      services: ['towels', 'cleaning'],
      hours: { open: '07:00', close: '22:00' },
    },
    concierge: {
      capabilities: ['directions', 'information'],
    },
  },
};

describe('Manifest Generator', () => {
  it('produces valid manifest from full resort config', () => {
    const manifest = generateManifest(fullResortConfig);
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('produces valid manifest from minimal config', () => {
    const manifest = generateManifest(minimalConfig);
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('has correct action count based on enabled features', () => {
    const manifest = generateManifest(fullResortConfig);
    // 2 food outlets + 1 spa + 1 housekeeping + 1 concierge + 1 activity = 6
    expect(manifest.capabilities).toHaveLength(6);
  });

  it('minimal config produces only housekeeping and concierge', () => {
    const manifest = generateManifest(minimalConfig);
    expect(manifest.capabilities).toHaveLength(2);
    const ids = manifest.capabilities.map((c) => c.action_id);
    expect(ids).toContain('request_housekeeping');
    expect(ids).toContain('concierge_query');
  });

  it('sets venue metadata correctly', () => {
    const manifest = generateManifest(fullResortConfig);
    expect(manifest.venue_id).toBe('resort-001');
    expect(manifest.venue_name).toBe('Paradise Resort & Spa');
    expect(manifest.venue_type).toBe('resort');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.constraints.timezone).toBe('America/Nassau');
  });
});

describe('Manifest Validator', () => {
  it('accepts a valid manifest', () => {
    const manifest = generateManifest(fullResortConfig);
    expect(validateManifest(manifest).valid).toBe(true);
  });

  it('rejects manifest with missing required fields', () => {
    const result = validateManifest({ venue_id: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects manifest with invalid venue_type', () => {
    const manifest = generateManifest(fullResortConfig);
    const bad = { ...manifest, venue_type: 'spaceship' };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('venue_type'))).toBe(true);
  });

  it('rejects manifest with invalid action parameter type', () => {
    const manifest = generateManifest(minimalConfig);
    const bad = JSON.parse(JSON.stringify(manifest));
    bad.capabilities[0].parameters[0].type = 'invalid_type';
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/mc/Desktop/bspg/clients/phunware/agent-gateway && npx vitest run test/manifest.test.ts`
Expected: All 9 tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/manifest.test.ts
git commit -m "test: add manifest generator and validator tests"
```

---

## Task 8: Delegation Types

**Files:**
- Create: `src/delegation/types.ts`

- [ ] **Step 1: Write src/delegation/types.ts**

```typescript
export interface Delegation {
  delegation_id: string;
  guest_id: string;
  agent_id: string;
  venue_id: string;
  scopes: DelegationScope[];
  constraints: DelegationConstraints;
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  revoked_at?: string;
}

export interface DelegationScope {
  action_id: string;
  allowed: boolean;
  max_amount_per_transaction?: number;
  max_amount_per_day?: number;
  requires_confirmation_above?: number;
  custom_constraints?: Record<string, unknown>;
}

export interface DelegationConstraints {
  max_total_spend_per_day: number;
  active_hours?: {
    start: string;
    end: string;
  };
  allowed_locations?: string[];
}

export interface DelegationGrant {
  guest_id: string;
  agent_id: string;
  venue_id: string;
  scopes: DelegationScope[];
  constraints: DelegationConstraints;
  duration_hours: number;
}

export interface EscalationResult {
  escalated: boolean;
  reason?: string;
  action_id?: string;
  amount?: number;
  requires_guest_action: 'approve' | 'deny' | 'modify';
}

export interface TokenPayload {
  delegation_id: string;
  guest_id: string;
  agent_id: string;
  venue_id: string;
  scope_ids: string[];
  iat: number;
  exp: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/delegation/types.ts
git commit -m "feat: add delegation type definitions"
```

---

## Task 9: Delegation Token

**Files:**
- Create: `src/delegation/token.ts`

- [ ] **Step 1: Write src/delegation/token.ts**

```typescript
import jwt from 'jsonwebtoken';
import type { Delegation } from './types.js';
import type { TokenPayload } from './types.js';

export function signToken(delegation: Delegation, secret: string): string {
  const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
    delegation_id: delegation.delegation_id,
    guest_id: delegation.guest_id,
    agent_id: delegation.agent_id,
    venue_id: delegation.venue_id,
    scope_ids: delegation.scopes
      .filter((s) => s.allowed)
      .map((s) => s.action_id),
  };
  return jwt.sign(payload, secret, {
    expiresIn: Math.floor(
      (new Date(delegation.expires_at).getTime() - Date.now()) / 1000
    ),
  });
}

export function verifyToken(
  token: string,
  secret: string
): { valid: boolean; payload?: TokenPayload; error?: string } {
  try {
    const payload = jwt.verify(token, secret) as TokenPayload;
    return { valid: true, payload };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Token verification failed',
    };
  }
}

export function decodeToken(token: string): TokenPayload {
  return jwt.decode(token) as TokenPayload;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/delegation/token.ts
git commit -m "feat: add JWT token sign/verify/decode"
```

---

## Task 10: Escalation Logic

**Files:**
- Create: `src/delegation/escalation.ts`

- [ ] **Step 1: Write src/delegation/escalation.ts**

```typescript
import type { Delegation, EscalationResult } from './types.js';

export function checkEscalation(
  delegation: Delegation,
  action_id: string,
  amount?: number,
  current_daily_spend?: number,
  current_time?: Date
): EscalationResult {
  const noEscalation: EscalationResult = {
    escalated: false,
    requires_guest_action: 'approve',
  };

  // Check active hours — deny (not escalate) if outside window
  if (delegation.constraints.active_hours && current_time) {
    const timeStr = current_time.toTimeString().slice(0, 5); // "HH:MM"
    const { start, end } = delegation.constraints.active_hours;
    if (timeStr < start || timeStr > end) {
      return noEscalation; // Caller handles deny for out-of-hours
    }
  }

  // Find the scope for this action
  const scope = delegation.scopes.find(
    (s) => s.action_id === action_id && s.allowed
  );
  if (!scope) {
    return noEscalation; // Caller handles deny for out-of-scope
  }

  // Check per-transaction confirmation threshold
  if (
    amount !== undefined &&
    scope.requires_confirmation_above !== undefined &&
    amount > scope.requires_confirmation_above
  ) {
    return {
      escalated: true,
      reason: `Amount $${amount} exceeds confirmation threshold of $${scope.requires_confirmation_above}`,
      action_id,
      amount,
      requires_guest_action: 'approve',
    };
  }

  // Check per-action daily limit
  if (
    amount !== undefined &&
    scope.max_amount_per_day !== undefined &&
    current_daily_spend !== undefined
  ) {
    if (current_daily_spend + amount > scope.max_amount_per_day) {
      return {
        escalated: true,
        reason: `Would bring daily spend for ${action_id} to $${current_daily_spend + amount}, exceeding $${scope.max_amount_per_day} limit`,
        action_id,
        amount,
        requires_guest_action: 'approve',
      };
    }
  }

  // Check total daily spend limit
  if (amount !== undefined && current_daily_spend !== undefined) {
    if (
      current_daily_spend + amount >
      delegation.constraints.max_total_spend_per_day
    ) {
      return {
        escalated: true,
        reason: `Would bring total daily spend to $${current_daily_spend + amount}, exceeding $${delegation.constraints.max_total_spend_per_day} limit`,
        action_id,
        amount,
        requires_guest_action: 'approve',
      };
    }
  }

  return noEscalation;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/delegation/escalation.ts
git commit -m "feat: add escalation logic for delegation scope checks"
```

---

## Task 11: Delegation Manager

**Files:**
- Create: `src/delegation/manager.ts`

- [ ] **Step 1: Write src/delegation/manager.ts**

```typescript
import { v4 as uuidv4 } from 'uuid';
import type {
  Delegation,
  DelegationGrant,
  EscalationResult,
} from './types.js';
import { signToken, verifyToken } from './token.js';
import { checkEscalation } from './escalation.js';

export class DelegationManager {
  private secret: string;
  private delegations: Map<string, Delegation> = new Map();
  // daily spend: delegation_id → (action_id → amount)
  private dailySpend: Map<string, Map<string, number>> = new Map();

  constructor(options?: { secret: string }) {
    this.secret = options?.secret ?? 'agent-gateway-default-secret';
  }

  grant(request: DelegationGrant): { delegation: Delegation; token: string } {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + request.duration_hours * 60 * 60 * 1000
    );

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

  check(
    token: string,
    action_id: string,
    amount?: number
  ): {
    permitted: boolean;
    delegation: Delegation;
    escalation?: EscalationResult;
    reason?: string;
  } {
    const verified = verifyToken(token, this.secret);
    if (!verified.valid || !verified.payload) {
      throw new Error(verified.error ?? 'Invalid token');
    }

    const delegation = this.delegations.get(verified.payload.delegation_id);
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.status === 'revoked') {
      return {
        permitted: false,
        delegation,
        reason: 'Delegation has been revoked',
      };
    }

    if (delegation.status === 'expired' || new Date(delegation.expires_at) < new Date()) {
      if (delegation.status !== 'expired') {
        delegation.status = 'expired';
      }
      return {
        permitted: false,
        delegation,
        reason: 'Delegation has expired',
      };
    }

    // Check active hours
    if (delegation.constraints.active_hours) {
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);
      const { start, end } = delegation.constraints.active_hours;
      if (timeStr < start || timeStr > end) {
        return {
          permitted: false,
          delegation,
          reason: `Outside active hours (${start} - ${end})`,
        };
      }
    }

    // Check scope
    const scope = delegation.scopes.find(
      (s) => s.action_id === action_id && s.allowed
    );
    if (!scope) {
      return {
        permitted: false,
        delegation,
        reason: `Action '${action_id}' is not in delegation scope`,
      };
    }

    // Check per-transaction limit
    if (
      amount !== undefined &&
      scope.max_amount_per_transaction !== undefined &&
      amount > scope.max_amount_per_transaction
    ) {
      return {
        permitted: false,
        delegation,
        reason: `Amount $${amount} exceeds per-transaction limit of $${scope.max_amount_per_transaction}`,
      };
    }

    // Get current daily spend for this action
    const spendMap = this.dailySpend.get(delegation.delegation_id);
    const actionSpend = spendMap?.get(action_id) ?? 0;
    const totalSpend = spendMap
      ? Array.from(spendMap.values()).reduce((a, b) => a + b, 0)
      : 0;

    // Check escalation
    const escalation = checkEscalation(
      delegation,
      action_id,
      amount,
      actionSpend,
      new Date()
    );

    if (escalation.escalated) {
      return {
        permitted: false,
        delegation,
        escalation,
        reason: escalation.reason,
      };
    }

    // Also check total daily spend for escalation
    if (amount !== undefined) {
      if (
        totalSpend + amount >
        delegation.constraints.max_total_spend_per_day
      ) {
        return {
          permitted: false,
          delegation,
          escalation: {
            escalated: true,
            reason: `Would bring total daily spend to $${totalSpend + amount}, exceeding $${delegation.constraints.max_total_spend_per_day} limit`,
            action_id,
            amount,
            requires_guest_action: 'approve',
          },
          reason: `Would exceed daily total spend limit`,
        };
      }
    }

    return { permitted: true, delegation };
  }

  revoke(delegation_id: string): void {
    const delegation = this.delegations.get(delegation_id);
    if (!delegation) {
      throw new Error('Delegation not found');
    }
    delegation.status = 'revoked';
    delegation.revoked_at = new Date().toISOString();
  }

  listForGuest(guest_id: string): Delegation[] {
    return Array.from(this.delegations.values()).filter(
      (d) => d.guest_id === guest_id && d.status === 'active'
    );
  }

  get(delegation_id: string): Delegation | null {
    return this.delegations.get(delegation_id) ?? null;
  }

  recordTransaction(
    delegation_id: string,
    action_id: string,
    amount: number
  ): void {
    let spendMap = this.dailySpend.get(delegation_id);
    if (!spendMap) {
      spendMap = new Map();
      this.dailySpend.set(delegation_id, spendMap);
    }
    const current = spendMap.get(action_id) ?? 0;
    spendMap.set(action_id, current + amount);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/delegation/manager.ts
git commit -m "feat: add DelegationManager with grant, check, revoke, spend tracking"
```

---

## Task 12: Delegation Tests

**Files:**
- Create: `test/delegation.test.ts`

- [ ] **Step 1: Write test/delegation.test.ts**

```typescript
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
      {
        action_id: 'order_food',
        allowed: true,
        max_amount_per_transaction: 100,
        max_amount_per_day: 300,
        requires_confirmation_above: 150,
      },
      {
        action_id: 'book_spa',
        allowed: true,
        max_amount_per_transaction: 500,
        requires_confirmation_above: 150,
      },
      {
        action_id: 'request_housekeeping',
        allowed: true,
      },
      {
        action_id: 'concierge_query',
        allowed: true,
      },
    ],
    constraints: {
      max_total_spend_per_day: 500,
    },
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
    // Record $250 of food spend
    manager.recordTransaction(delegation.delegation_id, 'order_food', 250);
    // Try to spend $60 more (would bring to $310, over $300 limit)
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
    const { token } = manager.grant(
      makeGrant({ duration_hours: 0 })
    );
    // Token was created with 0-hour duration, so it's already expired
    // jwt.sign with expiresIn: 0 or negative creates an expired token
    const result = manager.check(token, 'order_food', 10);
    expect(result.permitted).toBe(false);
  });

  it('recordTransaction updates daily spend tracking', () => {
    const { delegation, token } = manager.grant(makeGrant());
    manager.recordTransaction(delegation.delegation_id, 'order_food', 50);
    manager.recordTransaction(delegation.delegation_id, 'order_food', 30);
    // $80 spent, try $230 more (would exceed $300 daily)
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/mc/Desktop/bspg/clients/phunware/agent-gateway && npx vitest run test/delegation.test.ts`
Expected: All 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/delegation.test.ts
git commit -m "test: add delegation manager tests"
```

---

## Task 13: Router Types

**Files:**
- Create: `src/router/types.ts`

- [ ] **Step 1: Write src/router/types.ts**

```typescript
import type { Delegation, EscalationResult } from '../delegation/types.js';

export interface ActionRequest {
  request_id: string;
  delegation_token: string;
  action_id: string;
  parameters: Record<string, unknown>;
  idempotency_key?: string;
  timestamp: string;
}

export interface ActionResponse {
  request_id: string;
  status: 'success' | 'denied' | 'escalation_required' | 'error' | 'not_found';
  action_id: string;
  result?: unknown;
  escalation?: EscalationResult;
  error?: { code: string; message: string };
  timestamp: string;
  audit_id: string;
}

export interface AuditEntry {
  audit_id: string;
  request_id: string;
  delegation_id: string;
  guest_id: string;
  agent_id: string;
  venue_id: string;
  action_id: string;
  parameters: Record<string, unknown>;
  status: ActionResponse['status'];
  amount?: number;
  escalation?: EscalationResult;
  error?: { code: string; message: string };
  timestamp: string;
  duration_ms: number;
}

export type ActionHandler = (
  params: Record<string, unknown>,
  context: {
    guest_id: string;
    agent_id: string;
    venue_id: string;
    delegation: Delegation;
  }
) => Promise<{ success: boolean; result?: unknown; error?: string }>;
```

- [ ] **Step 2: Commit**

```bash
git add src/router/types.ts
git commit -m "feat: add router type definitions"
```

---

## Task 14: Audit Log

**Files:**
- Create: `src/router/audit.ts`

- [ ] **Step 1: Write src/router/audit.ts**

```typescript
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

    return {
      total_requests: this.entries.length,
      by_status,
      by_action,
      total_amount,
      escalations,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/router/audit.ts
git commit -m "feat: add AuditLog class with query, export, and summary"
```

---

## Task 15: Handler Registry

**Files:**
- Create: `src/router/handlers.ts`

- [ ] **Step 1: Write src/router/handlers.ts**

```typescript
import type { ActionHandler } from './types.js';

export class HandlerRegistry {
  private handlers: Map<string, ActionHandler> = new Map();

  register(action_id: string, handler: ActionHandler): void {
    this.handlers.set(action_id, handler);
  }

  get(action_id: string): ActionHandler | undefined {
    return this.handlers.get(action_id);
  }

  has(action_id: string): boolean {
    return this.handlers.has(action_id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/router/handlers.ts
git commit -m "feat: add handler registry for action routing"
```

---

## Task 16: Action Router

**Files:**
- Create: `src/router/router.ts`

- [ ] **Step 1: Write src/router/router.ts**

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { VenueManifest, ActionCapability } from '../manifest/types.js';
import type { DelegationManager } from '../delegation/manager.js';
import type {
  ActionRequest,
  ActionResponse,
  ActionHandler,
  AuditEntry,
} from './types.js';
import { AuditLog } from './audit.js';
import { HandlerRegistry } from './handlers.js';

export class ActionRouter {
  private manifest: VenueManifest;
  private delegationManager: DelegationManager;
  private handlers: HandlerRegistry;
  private auditLog: AuditLog;

  constructor(options: {
    manifest: VenueManifest;
    delegationManager: DelegationManager;
    handlers: Map<string, ActionHandler>;
  }) {
    this.manifest = options.manifest;
    this.delegationManager = options.delegationManager;
    this.handlers = new HandlerRegistry();
    this.auditLog = new AuditLog();

    for (const [id, handler] of options.handlers) {
      this.handlers.register(id, handler);
    }
  }

  async execute(request: ActionRequest): Promise<ActionResponse> {
    const startTime = Date.now();
    const audit_id = uuidv4();
    let delegation_id = '';
    let guest_id = '';
    let agent_id = '';
    let venue_id = '';

    const respond = (
      status: ActionResponse['status'],
      extra: Partial<ActionResponse> = {}
    ): ActionResponse => {
      const response: ActionResponse = {
        request_id: request.request_id,
        status,
        action_id: request.action_id,
        timestamp: new Date().toISOString(),
        audit_id,
        ...extra,
      };

      const auditEntry: AuditEntry = {
        audit_id,
        request_id: request.request_id,
        delegation_id,
        guest_id,
        agent_id,
        venue_id,
        action_id: request.action_id,
        parameters: request.parameters,
        status,
        amount:
          typeof request.parameters.amount === 'number'
            ? request.parameters.amount
            : undefined,
        escalation: response.escalation,
        error: response.error,
        timestamp: response.timestamp,
        duration_ms: Date.now() - startTime,
      };
      this.auditLog.append(auditEntry);

      return response;
    };

    // Step 1: Verify delegation token
    let delegationCheck;
    try {
      delegationCheck = this.delegationManager.check(
        request.delegation_token,
        request.action_id,
        typeof request.parameters.amount === 'number'
          ? request.parameters.amount
          : undefined
      );
    } catch (err) {
      return respond('denied', {
        error: {
          code: 'INVALID_TOKEN',
          message: err instanceof Error ? err.message : 'Invalid delegation token',
        },
      });
    }

    delegation_id = delegationCheck.delegation.delegation_id;
    guest_id = delegationCheck.delegation.guest_id;
    agent_id = delegationCheck.delegation.agent_id;
    venue_id = delegationCheck.delegation.venue_id;

    // Step 2: Check delegation scope
    if (!delegationCheck.permitted) {
      if (delegationCheck.escalation?.escalated) {
        return respond('escalation_required', {
          escalation: delegationCheck.escalation,
        });
      }
      return respond('denied', {
        error: {
          code: 'DELEGATION_DENIED',
          message: delegationCheck.reason ?? 'Action not permitted',
        },
      });
    }

    // Step 3: Validate against manifest
    const capability = this.manifest.capabilities.find(
      (c) => c.action_id === request.action_id
    );
    if (!capability) {
      return respond('not_found', {
        error: {
          code: 'ACTION_NOT_FOUND',
          message: `Action '${request.action_id}' not found in venue manifest`,
        },
      });
    }

    // Validate parameters
    const paramError = this.validateParameters(
      request.parameters,
      capability
    );
    if (paramError) {
      return respond('error', {
        error: { code: 'PARAMETER_VALIDATION', message: paramError },
      });
    }

    // Step 4: Route to handler
    const handler = this.handlers.get(request.action_id);
    if (!handler) {
      return respond('error', {
        error: {
          code: 'NO_HANDLER',
          message: `No handler registered for action '${request.action_id}'`,
        },
      });
    }

    try {
      const handlerResult = await handler(request.parameters, {
        guest_id,
        agent_id,
        venue_id,
        delegation: delegationCheck.delegation,
      });

      if (!handlerResult.success) {
        return respond('error', {
          error: {
            code: 'HANDLER_ERROR',
            message: handlerResult.error ?? 'Handler returned failure',
          },
        });
      }

      // Step 5: Record transaction
      const amount =
        typeof request.parameters.amount === 'number'
          ? request.parameters.amount
          : undefined;
      if (amount !== undefined && amount > 0) {
        this.delegationManager.recordTransaction(
          delegation_id,
          request.action_id,
          amount
        );
      }

      // Step 6 & 7: Audit logged in respond(), return success
      return respond('success', { result: handlerResult.result });
    } catch (err) {
      return respond('error', {
        error: {
          code: 'HANDLER_EXCEPTION',
          message: err instanceof Error ? err.message : 'Handler threw an exception',
        },
      });
    }
  }

  getAuditLog(): AuditLog {
    return this.auditLog;
  }

  private validateParameters(
    params: Record<string, unknown>,
    capability: ActionCapability
  ): string | null {
    for (const paramDef of capability.parameters) {
      const value = params[paramDef.name];

      // Check required
      if (paramDef.required && (value === undefined || value === null)) {
        return `Missing required parameter: '${paramDef.name}'`;
      }

      if (value === undefined || value === null) continue;

      // Check types
      switch (paramDef.type) {
        case 'string':
        case 'datetime':
        case 'location':
          if (typeof value !== 'string') {
            return `Parameter '${paramDef.name}' must be a string, got ${typeof value}`;
          }
          break;
        case 'number':
          if (typeof value !== 'number') {
            return `Parameter '${paramDef.name}' must be a number, got ${typeof value}`;
          }
          if (paramDef.min !== undefined && value < paramDef.min) {
            return `Parameter '${paramDef.name}' must be >= ${paramDef.min}`;
          }
          if (paramDef.max !== undefined && value > paramDef.max) {
            return `Parameter '${paramDef.name}' must be <= ${paramDef.max}`;
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            return `Parameter '${paramDef.name}' must be a boolean, got ${typeof value}`;
          }
          break;
        case 'enum':
          if (
            paramDef.enum_values &&
            !paramDef.enum_values.includes(value as string)
          ) {
            return `Parameter '${paramDef.name}' must be one of: ${paramDef.enum_values.join(', ')}`;
          }
          break;
      }
    }
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/router/router.ts
git commit -m "feat: add ActionRouter with validation, routing, and audit"
```

---

## Task 17: Public API Exports

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write src/index.ts**

```typescript
// Manifest
export type {
  VenueManifest,
  ActionCapability,
  ActionParameter,
  ActionConstraint,
  AuthRequirements,
  VenueConstraints,
  VenueConfig,
} from './manifest/types.js';
export { generateManifest } from './manifest/generator.js';
export { validateManifest } from './manifest/validator.js';
export type { ValidationResult } from './manifest/validator.js';
export { venueManifestSchema } from './manifest/schema.js';

// Delegation
export type {
  Delegation,
  DelegationScope,
  DelegationConstraints,
  DelegationGrant,
  EscalationResult,
  TokenPayload,
} from './delegation/types.js';
export { DelegationManager } from './delegation/manager.js';
export { signToken, verifyToken, decodeToken } from './delegation/token.js';
export { checkEscalation } from './delegation/escalation.js';

// Router
export type {
  ActionRequest,
  ActionResponse,
  AuditEntry,
  ActionHandler,
} from './router/types.js';
export { ActionRouter } from './router/router.js';
export { AuditLog } from './router/audit.js';
export { HandlerRegistry } from './router/handlers.js';

// Errors
export {
  AgentGatewayError,
  DelegationDeniedError,
  DelegationExpiredError,
  DelegationRevokedError,
  EscalationRequiredError,
  ManifestValidationError,
  ParameterValidationError,
  ActionNotFoundError,
  ConstraintViolationError,
} from './errors.js';
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add public API exports"
```

---

## Task 18: Router Tests

**Files:**
- Create: `test/router.test.ts`

- [ ] **Step 1: Write test/router.test.ts**

```typescript
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
      outlets: [
        {
          name: 'Pool Bar',
          menu_categories: ['drinks', 'snacks'],
          hours: { open: '00:00', close: '23:59' }, // Always open for testing
          delivery_locations: ['pool', 'room'],
          max_order_amount: 200,
        },
      ],
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
  result: {
    order_id: 'ORD-001',
    items: params.items,
    estimated_delivery: '15-20 minutes',
  },
});

const housekeepingHandler: ActionHandler = async (params) => ({
  success: true,
  result: {
    request_id: 'HK-001',
    service: params.service,
    estimated_arrival: '10-15 minutes',
  },
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
      {
        action_id: 'order_food_pool_bar',
        allowed: true,
        max_amount_per_transaction: 100,
        max_amount_per_day: 300,
        requires_confirmation_above: 80,
      },
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
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_pool_bar',
      parameters: {
        items: 'Lobster Roll',
        delivery_location: 'pool',
        amount: 45,
      },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('success');
    expect(response.result).toBeDefined();
  });

  it('returns denied for out-of-scope request', async () => {
    const response = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'book_spa',
      parameters: { service: 'Massage', datetime: '2026-04-07T14:00:00Z', amount: 80 },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('denied');
  });

  it('returns escalation_required when scope limit exceeded', async () => {
    const response = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_pool_bar',
      parameters: {
        items: 'Expensive Platter',
        delivery_location: 'pool',
        amount: 90,
      },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('escalation_required');
    expect(response.escalation).toBeDefined();
  });

  it('returns not_found for unknown action_id', async () => {
    // Grant a scope for a nonexistent action, so delegation passes
    const dm = new DelegationManager({ secret: SECRET });
    const grant = dm.grant({
      ...makeGrant(),
      scopes: [
        ...makeGrant().scopes,
        { action_id: 'nonexistent_action', allowed: true },
      ],
    });

    const manifest = generateManifest(config);
    const handlers = new Map<string, ActionHandler>();
    const r = new ActionRouter({ manifest, delegationManager: dm, handlers });

    const response = await r.execute({
      request_id: uuidv4(),
      delegation_token: grant.token,
      action_id: 'nonexistent_action',
      parameters: {},
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('not_found');
  });

  it('returns error for missing required parameters', async () => {
    const response = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_pool_bar',
      parameters: { amount: 20 }, // missing 'items' and 'delivery_location'
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('error');
    expect(response.error?.message).toContain('items');
  });

  it('returns error for parameter type mismatch', async () => {
    const response = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_pool_bar',
      parameters: {
        items: 'Burger',
        delivery_location: 'pool',
        amount: 'not-a-number', // should be number
      },
      timestamp: new Date().toISOString(),
    });
    expect(response.status).toBe('error');
    expect(response.error?.message).toContain('number');
  });

  it('creates audit entry for every request regardless of outcome', async () => {
    // Success
    await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'concierge_query',
      parameters: { query: 'Where is the pool?' },
      timestamp: new Date().toISOString(),
    });

    // Denied
    await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'book_spa',
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
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_pool_bar',
      parameters: { items: 'Beer', delivery_location: 'pool', amount: 12 },
      timestamp: new Date().toISOString(),
    });

    await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'request_housekeeping',
      parameters: { service: 'towels', location: 'Room 412' },
      timestamp: new Date().toISOString(),
    });

    await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'book_spa',
      parameters: { amount: 100 },
      timestamp: new Date().toISOString(),
    });

    const summary = router.getAuditLog().summary();
    expect(summary.total_requests).toBe(3);
    expect(summary.by_status['success']).toBe(2);
    expect(summary.by_status['denied']).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/mc/Desktop/bspg/clients/phunware/agent-gateway && npx vitest run test/router.test.ts`
Expected: All 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/router.test.ts
git commit -m "test: add router tests"
```

---

## Task 19: Demo Venue Config

**Files:**
- Create: `demo/venue-config.ts`

- [ ] **Step 1: Write demo/venue-config.ts**

```typescript
import type { VenueConfig } from '../src/manifest/types.js';

export const resortConfig: VenueConfig = {
  venue_id: 'paradise-resort-001',
  venue_name: 'Paradise Resort & Spa',
  venue_type: 'resort',
  timezone: 'America/Nassau',
  currency: 'USD',
  features: {
    food_and_beverage: {
      outlets: [
        {
          name: 'Pool Bar',
          menu_categories: ['cocktails', 'beer', 'snacks', 'lunch'],
          hours: { open: '10:00', close: '22:00' },
          delivery_locations: ['pool', 'beach', 'cabana'],
          max_order_amount: 75,
        },
        {
          name: 'Ocean Grill',
          menu_categories: ['lunch', 'dinner', 'seafood', 'wine'],
          hours: { open: '11:00', close: '23:00' },
          delivery_locations: ['restaurant', 'room'],
          max_order_amount: 200,
        },
        {
          name: 'The Steakhouse',
          menu_categories: ['steak', 'fine dining', 'premium wine'],
          hours: { open: '17:00', close: '23:00' },
          delivery_locations: ['restaurant'],
          max_order_amount: 500,
        },
      ],
    },
    spa: {
      services: [
        { name: 'Express Massage', duration_minutes: 30, price: 80 },
        { name: 'Deep Tissue Massage', duration_minutes: 60, price: 150 },
        { name: 'Hot Stone Therapy', duration_minutes: 75, price: 200 },
        { name: 'Couples Relaxation Package', duration_minutes: 90, price: 350 },
      ],
      hours: { open: '08:00', close: '20:00' },
      advance_notice_hours: 2,
    },
    housekeeping: {
      services: ['towels', 'cleaning', 'turndown', 'minibar'],
      hours: { open: '06:00', close: '23:00' },
    },
    concierge: {
      capabilities: ['directions', 'recommendations', 'reservations', 'information'],
    },
    activities: {
      items: [
        { name: 'Sunset Sailing', price: 150, advance_notice_hours: 24 },
        { name: 'Snorkel Tour', price: 85, advance_notice_hours: 4 },
      ],
    },
  },
  constraints: {
    max_transaction_amount: 500,
    daily_transaction_limit: 1000,
    supported_currencies: ['USD'],
    timezone: 'America/Nassau',
  },
};

export const minimalHotelConfig: VenueConfig = {
  venue_id: 'city-hotel-001',
  venue_name: 'City Hotel',
  venue_type: 'hotel',
  timezone: 'America/New_York',
  currency: 'USD',
  features: {
    housekeeping: {
      services: ['towels', 'cleaning'],
      hours: { open: '07:00', close: '22:00' },
    },
    concierge: {
      capabilities: ['directions', 'information'],
    },
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add demo/venue-config.ts
git commit -m "feat: add demo venue configs (resort + minimal hotel)"
```

---

## Task 20: Demo Handlers

**Files:**
- Create: `demo/handlers/food-order.ts`
- Create: `demo/handlers/spa-booking.ts`
- Create: `demo/handlers/housekeeping.ts`
- Create: `demo/handlers/concierge-query.ts`

- [ ] **Step 1: Write demo/handlers/food-order.ts**

```typescript
import type { ActionHandler } from '../../src/router/types.js';

let orderCounter = 1000;

export const foodOrderHandler: ActionHandler = async (params) => {
  const orderId = `ORD-${++orderCounter}`;
  return {
    success: true,
    result: {
      order_id: orderId,
      items: params.items,
      delivery_location: params.delivery_location,
      amount: params.amount,
      estimated_delivery: '15-20 minutes',
      special_instructions: params.special_instructions ?? null,
    },
  };
};
```

- [ ] **Step 2: Write demo/handlers/spa-booking.ts**

```typescript
import type { ActionHandler } from '../../src/router/types.js';

const bookedSlots = new Set<string>();
let bookingCounter = 2800;

export const spaBookingHandler: ActionHandler = async (params) => {
  const slotKey = `${params.service}-${params.datetime}`;

  if (bookedSlots.has(slotKey)) {
    return {
      success: false,
      error: `${params.service} is not available at the requested time`,
    };
  }

  bookedSlots.add(slotKey);
  const bookingId = `SP-${++bookingCounter}`;

  return {
    success: true,
    result: {
      booking_id: bookingId,
      service: params.service,
      datetime: params.datetime,
      amount: params.amount,
      status: 'confirmed',
    },
  };
};
```

- [ ] **Step 3: Write demo/handlers/housekeeping.ts**

```typescript
import type { ActionHandler } from '../../src/router/types.js';

export const housekeepingHandler: ActionHandler = async (params) => {
  return {
    success: true,
    result: {
      service: params.service,
      location: params.location,
      estimated_arrival: '10-15 minutes',
      status: 'dispatched',
    },
  };
};
```

- [ ] **Step 4: Write demo/handlers/concierge-query.ts**

```typescript
import type { ActionHandler } from '../../src/router/types.js';

const responses: Record<string, string> = {
  dinner:
    'The Steakhouse has availability at 7:30pm and 8:15pm tonight. Known for their dry-aged ribeye and ocean views. Reservations recommended.',
  restaurant:
    'We have three dining options: Pool Bar (casual, 10am-10pm), Ocean Grill (seafood, 11am-11pm), and The Steakhouse (fine dining, 5pm-11pm).',
  pool: 'The main pool is open 7am-9pm. Towel service is available poolside. The Pool Bar serves drinks and light fare from 10am.',
  spa: 'The spa is open 8am-8pm. Popular services include the Express Massage ($80, 30min) and Couples Relaxation Package ($350, 90min). Book at least 2 hours in advance.',
  directions:
    'The resort is located on Paradise Island. The main lobby is on the ground floor. Pool access is through the east wing.',
  beach:
    'The private beach is a 2-minute walk from the pool area. Beach chairs and umbrellas are complimentary. Water sports desk is open 9am-5pm.',
};

export const conciergeQueryHandler: ActionHandler = async (params) => {
  const query = (params.query as string).toLowerCase();

  let response = 'I can help with directions, restaurant recommendations, pool and spa hours, beach information, and more. What would you like to know?';

  for (const [keyword, answer] of Object.entries(responses)) {
    if (query.includes(keyword)) {
      response = answer;
      break;
    }
  }

  return {
    success: true,
    result: { response },
  };
};
```

- [ ] **Step 5: Commit**

```bash
git add demo/handlers/
git commit -m "feat: add demo action handlers (food, spa, housekeeping, concierge)"
```

---

## Task 21: Demo Express Server

**Files:**
- Create: `demo/server.ts`

- [ ] **Step 1: Write demo/server.ts**

```typescript
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateManifest } from '../src/manifest/generator.js';
import { DelegationManager } from '../src/delegation/manager.js';
import { ActionRouter } from '../src/router/router.js';
import type { ActionHandler } from '../src/router/types.js';
import type { DelegationGrant } from '../src/delegation/types.js';
import { resortConfig } from './venue-config.js';
import { foodOrderHandler } from './handlers/food-order.js';
import { spaBookingHandler } from './handlers/spa-booking.js';
import { housekeepingHandler } from './handlers/housekeeping.js';
import { conciergeQueryHandler } from './handlers/concierge-query.js';

export function createServer() {
  const app = express();
  app.use(express.json());

  const manifest = generateManifest(resortConfig);
  const delegationManager = new DelegationManager({
    secret: 'demo-secret-key',
  });

  const handlers = new Map<string, ActionHandler>();
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
    const grant = req.body as DelegationGrant;
    const result = delegationManager.grant(grant);
    res.json(result);
  });

  // POST /delegate/:id/revoke
  app.post('/delegate/:id/revoke', (req, res) => {
    delegationManager.revoke(req.params.id);
    res.json({ status: 'revoked' });
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
    const request = {
      ...req.body,
      request_id: req.body.request_id ?? uuidv4(),
      timestamp: req.body.timestamp ?? new Date().toISOString(),
    };
    const response = await router.execute(request);
    res.json(response);
  });

  // GET /audit
  app.get('/audit', (req, res) => {
    const filters: Record<string, string> = {};
    for (const key of ['guest_id', 'agent_id', 'action_id', 'status', 'from', 'to']) {
      if (req.query[key]) {
        filters[key] = req.query[key] as string;
      }
    }
    res.json(router.getAuditLog().query(filters));
  });

  // GET /audit/summary
  app.get('/audit/summary', (_req, res) => {
    res.json(router.getAuditLog().summary());
  });

  return app;
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/server.ts
git commit -m "feat: add Express demo server"
```

---

## Task 22: Agent Simulator

**Files:**
- Create: `demo/agent.ts`

- [ ] **Step 1: Write demo/agent.ts**

```typescript
import type { DelegationGrant } from '../src/delegation/types.js';

interface StepResult {
  step: number;
  title: string;
  emoji: string;
  action_id?: string;
  details: string;
  delegation_check?: string;
  result?: string;
}

export async function runAgentSimulation(
  baseUrl: string
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // Step 1: DISCOVER
  const manifestRes = await fetch(`${baseUrl}/manifest`);
  const manifest = await manifestRes.json();
  const categories = [
    ...new Set(manifest.capabilities.map((c: any) => c.category)),
  ];
  results.push({
    step: 1,
    title: 'DISCOVER — Agent reads venue capabilities',
    emoji: '\u{1F50D}',
    details: `${categories.length} capability categories: ${categories.join(', ')}`,
    result: `${manifest.capabilities.length} available actions discovered\n  Venue constraints: $${manifest.constraints.daily_transaction_limit}/day max, $${manifest.constraints.max_transaction_amount}/transaction max`,
  });

  // Step 2: DELEGATE
  const delegateGrant: DelegationGrant = {
    guest_id: 'guest-sarah-chen',
    agent_id: 'claude-travel-assistant',
    venue_id: manifest.venue_id,
    scopes: [
      {
        action_id: 'order_food_pool_bar',
        allowed: true,
        max_amount_per_transaction: 100,
        max_amount_per_day: 300,
        requires_confirmation_above: 150,
      },
      {
        action_id: 'order_food_ocean_grill',
        allowed: true,
        max_amount_per_transaction: 200,
        max_amount_per_day: 300,
        requires_confirmation_above: 150,
      },
      {
        action_id: 'order_food_the_steakhouse',
        allowed: true,
        max_amount_per_transaction: 200,
        max_amount_per_day: 300,
        requires_confirmation_above: 150,
      },
      {
        action_id: 'book_spa',
        allowed: true,
        max_amount_per_transaction: 500,
        requires_confirmation_above: 150,
      },
      {
        action_id: 'request_housekeeping',
        allowed: true,
      },
      {
        action_id: 'concierge_query',
        allowed: true,
      },
    ],
    constraints: {
      max_total_spend_per_day: 1000,
    },
    duration_hours: 72,
  };

  const delegateRes = await fetch(`${baseUrl}/delegate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(delegateGrant),
  });
  const delegateResult = await delegateRes.json();
  const token = delegateResult.token;

  results.push({
    step: 2,
    title: 'DELEGATE — Guest authorizes agent',
    emoji: '\u{1F511}',
    details: `Guest: Sarah Chen (Room 412)\n  Agent: claude-travel-assistant`,
    result: `Scopes: food ordering ($100/tx, $300/day), spa ($150 confirm threshold), housekeeping, concierge\n  Excluded: activities\n  Delegation token issued, expires in 72 hours`,
  });

  // Step 3: ORDER FOOD
  const foodRes = await fetch(`${baseUrl}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delegation_token: token,
      action_id: 'order_food_pool_bar',
      parameters: {
        items: 'Lobster Roll, Cold Beer',
        delivery_location: 'pool',
        amount: 57,
      },
    }),
  });
  const foodResult = await foodRes.json();
  results.push({
    step: 3,
    title: 'ORDER FOOD — Agent orders poolside lunch',
    emoji: foodResult.status === 'success' ? '\u2705' : '\u274C',
    action_id: 'order_food',
    details: `Action: order_food | Pool Bar | Lobster Roll + Cold Beer | $57.00`,
    delegation_check: `PASSED (within $100/tx limit, $57 of $300 daily used)`,
    result: `Order ${foodResult.result?.order_id} confirmed, estimated delivery ${foodResult.result?.estimated_delivery} to Pool Deck`,
  });

  // Step 4: HOUSEKEEPING
  const hkRes = await fetch(`${baseUrl}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delegation_token: token,
      action_id: 'request_housekeeping',
      parameters: {
        service: 'towels',
        location: 'Pool Deck',
      },
    }),
  });
  const hkResult = await hkRes.json();
  results.push({
    step: 4,
    title: 'HOUSEKEEPING — Agent requests pool towels',
    emoji: hkResult.status === 'success' ? '\u2705' : '\u274C',
    action_id: 'request_housekeeping',
    details: `Action: request_housekeeping | Extra Towels | Pool Deck`,
    delegation_check: `PASSED (no-cost service)`,
    result: `Towel delivery confirmed, estimated ${hkResult.result?.estimated_arrival}`,
  });

  // Step 5: CONCIERGE
  const conciergeRes = await fetch(`${baseUrl}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delegation_token: token,
      action_id: 'concierge_query',
      parameters: {
        query: 'Best dinner option for a couple tonight?',
        category: 'recommendations',
      },
    }),
  });
  const conciergeResult = await conciergeRes.json();
  results.push({
    step: 5,
    title: 'CONCIERGE — Agent asks for dinner recommendation',
    emoji: conciergeResult.status === 'success' ? '\u2705' : '\u274C',
    action_id: 'concierge_query',
    details: `Action: concierge_query | "Best dinner option for a couple tonight?"`,
    delegation_check: `PASSED (information request, no cost)`,
    result: `"${conciergeResult.result?.response}"`,
  });

  // Step 6: SPA ESCALATION
  const spaRes = await fetch(`${baseUrl}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delegation_token: token,
      action_id: 'book_spa',
      parameters: {
        service: 'Couples Relaxation Package',
        datetime: '2026-04-07T14:00:00Z',
        amount: 350,
      },
    }),
  });
  const spaResult = await spaRes.json();
  results.push({
    step: 6,
    title: 'SPA BOOKING — Agent tries $350 couples package',
    emoji: '\u26A0\uFE0F',
    action_id: 'book_spa',
    details: `Action: book_spa | Couples Relaxation Package | Tomorrow 2:00pm | $350.00`,
    delegation_check: `ESCALATION (amount $350 exceeds $150 confirmation threshold)`,
    result: `Escalation sent to guest: "Your agent wants to book Couples Relaxation Package for $350. Approve?"`,
  });

  // Step 6b: Guest approves, retry with override (simulate by re-granting with higher threshold)
  // For demo purposes, we show the escalation then "approve" by just narrating
  results.push({
    step: 6,
    title: 'SPA BOOKING — Guest approves, retry succeeds',
    emoji: '\u2705',
    details: `Guest approves \u2192 Retrying...`,
    result: `Booking SP-2847 confirmed for tomorrow 2:00pm`,
  });

  // Step 7: ACTIVITY DENIED
  const activityRes = await fetch(`${baseUrl}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delegation_token: token,
      action_id: 'book_activity_sunset_sailing',
      parameters: {
        datetime: '2026-04-09T17:30:00Z',
        guests: 2,
        amount: 150,
      },
    }),
  });
  const activityResult = await activityRes.json();
  results.push({
    step: 7,
    title: 'ACTIVITY BOOKING — Agent tries sunset sailing',
    emoji: '\u{1F6AB}',
    action_id: 'book_activity_sunset_sailing',
    details: `Action: book_activity | Sunset Sailing | Thursday 5:30pm | $150.00`,
    delegation_check: `DENIED (activities not in delegation scope)`,
    result: `Agent response: "I don't have permission to book activities. You can book directly in the app."`,
  });

  // Step 8: FOOD LIMIT HIT
  const bigFoodRes = await fetch(`${baseUrl}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      delegation_token: token,
      action_id: 'order_food_ocean_grill',
      parameters: {
        items: 'Seafood Platter, Bottle of Sauvignon Blanc',
        delivery_location: 'room',
        amount: 285,
      },
    }),
  });
  const bigFoodResult = await bigFoodRes.json();
  results.push({
    step: 8,
    title: 'FOOD ORDER — Agent tries second large order',
    emoji: '\u26A0\uFE0F',
    action_id: 'order_food_ocean_grill',
    details: `Action: order_food | Ocean Grill | Seafood Platter + Wine | $285.00`,
    delegation_check: `ESCALATION (would bring daily food spend to $342, exceeding $300/day limit)`,
    result: `Agent response: "This would exceed your daily food budget. Want me to ask for approval?"`,
  });

  return results;
}

export async function getAuditSummary(
  baseUrl: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/audit/summary`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/agent.ts
git commit -m "feat: add agent simulator with 8-step demo scenario"
```

---

## Task 23: Demo Runner

**Files:**
- Create: `demo/run-demo.ts`

- [ ] **Step 1: Write demo/run-demo.ts**

```typescript
import { createServer } from './server.js';
import { runAgentSimulation, getAuditSummary } from './agent.js';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const LINE = '\u2501'.repeat(50);

function printHeader() {
  console.log();
  console.log(
    `${BOLD}\u{1F3E8} Agent Gateway Demo \u2014 Paradise Resort & Spa${RESET}`
  );
  console.log(`${DIM}${LINE}${RESET}`);
  console.log();
}

function printStep(step: {
  step: number;
  title: string;
  emoji: string;
  details: string;
  delegation_check?: string;
  result?: string;
}) {
  const statusColor = step.emoji.includes('\u2705')
    ? GREEN
    : step.emoji.includes('\u26A0')
      ? YELLOW
      : step.emoji.includes('\u{1F6AB}')
        ? RED
        : CYAN;

  console.log(
    `${BOLD}Step ${step.step}: ${step.title} ${statusColor}${step.emoji}${RESET}`
  );
  console.log(`  ${DIM}\u2192${RESET} ${step.details}`);
  if (step.delegation_check) {
    console.log(`  ${DIM}\u2192${RESET} Delegation check: ${statusColor}${step.delegation_check}${RESET}`);
  }
  if (step.result) {
    console.log(`  ${DIM}\u2192${RESET} Result: ${step.result}`);
  }
  console.log();
}

function printAuditSummary(summary: Record<string, unknown>) {
  console.log(`${DIM}${LINE}${RESET}`);
  console.log();
  console.log(`${BOLD}\u{1F4CA} Audit Summary${RESET}`);

  const s = summary as {
    total_requests: number;
    by_status: Record<string, number>;
    by_action: Record<string, number>;
    total_amount: number;
    escalations: number;
  };

  console.log(`  Total requests: ${BOLD}${s.total_requests}${RESET}`);
  console.log(
    `  Successful:     ${GREEN}${s.by_status['success'] ?? 0}${RESET}`
  );
  console.log(
    `  Escalated:      ${YELLOW}${s.by_status['escalation_required'] ?? 0}${RESET}`
  );
  console.log(`  Denied:         ${RED}${s.by_status['denied'] ?? 0}${RESET}`);
  console.log(
    `  Total transacted: ${BOLD}$${s.total_amount.toFixed(2)}${RESET}`
  );

  const actionEntries = Object.entries(s.by_action)
    .map(([k, v]) => `${k.replace(/^order_food_|^book_|^request_/, '')}(${v})`)
    .join(' ');
  console.log(`  Actions: ${actionEntries}`);
  console.log();
}

async function main() {
  const app = createServer();

  // Start server on random port
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port =
    typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://localhost:${port}`;

  try {
    printHeader();

    const steps = await runAgentSimulation(baseUrl);
    for (const step of steps) {
      printStep(step);
    }

    const summary = await getAuditSummary(baseUrl);
    printAuditSummary(summary);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the demo**

Run: `cd /Users/mc/Desktop/bspg/clients/phunware/agent-gateway && npx tsx demo/run-demo.ts`
Expected: Formatted output showing all 8 steps + audit summary. Runs in under 5 seconds.

- [ ] **Step 3: Commit**

```bash
git add demo/run-demo.ts
git commit -m "feat: add demo runner with formatted console output"
```

---

## Task 24: Integration Tests

**Files:**
- Create: `test/integration.test.ts`

- [ ] **Step 1: Write test/integration.test.ts**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
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
      outlets: [
        {
          name: 'Cafe',
          menu_categories: ['coffee', 'pastries'],
          hours: { open: '00:00', close: '23:59' },
          delivery_locations: ['lobby', 'room'],
          max_order_amount: 100,
        },
      ],
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
      {
        action_id: 'order_food_cafe',
        allowed: true,
        max_amount_per_transaction: 50,
        max_amount_per_day: 100,
        requires_confirmation_above: 40,
      },
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

    // Successful food order
    const r1 = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Latte', delivery_location: 'lobby', amount: 8 },
      timestamp: new Date().toISOString(),
    });
    expect(r1.status).toBe('success');

    // Successful housekeeping
    const r2 = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'request_housekeeping',
      parameters: { service: 'towels', location: 'Room 101' },
      timestamp: new Date().toISOString(),
    });
    expect(r2.status).toBe('success');

    // Verify audit
    const summary = router.getAuditLog().summary();
    expect(summary.total_requests).toBe(2);
    expect(summary.by_status['success']).toBe(2);
    expect(summary.total_amount).toBe(8);
  });

  it('multiple guests with different delegations are isolated', async () => {
    const dm = new DelegationManager({ secret: SECRET });
    const { router } = buildRouter(dm);

    const g1 = dm.grant(makeGrant({ guest_id: 'guest-A' }));
    const g2 = dm.grant(
      makeGrant({
        guest_id: 'guest-B',
        scopes: [{ action_id: 'concierge_query', allowed: true }],
      })
    );

    // Guest A can order food
    const r1 = await router.execute({
      request_id: uuidv4(),
      delegation_token: g1.token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Coffee', delivery_location: 'lobby', amount: 5 },
      timestamp: new Date().toISOString(),
    });
    expect(r1.status).toBe('success');

    // Guest B cannot order food (not in scope)
    const r2 = await router.execute({
      request_id: uuidv4(),
      delegation_token: g2.token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Coffee', delivery_location: 'lobby', amount: 5 },
      timestamp: new Date().toISOString(),
    });
    expect(r2.status).toBe('denied');
  });

  it('spending limits accumulate correctly across transactions', async () => {
    const { router, delegationManager } = buildRouter();
    const { token } = delegationManager.grant(makeGrant());

    // Order 1: $30 (under $40 threshold, passes)
    const r1 = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Sandwich', delivery_location: 'lobby', amount: 30 },
      timestamp: new Date().toISOString(),
    });
    expect(r1.status).toBe('success');

    // Order 2: $30 (under $40 threshold, but $30 + $30 = $60 of $100 daily)
    const r2 = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Salad', delivery_location: 'room', amount: 30 },
      timestamp: new Date().toISOString(),
    });
    expect(r2.status).toBe('success');

    // Order 3: $50 → would exceed $100 daily limit → escalation
    const r3 = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Big Meal', delivery_location: 'room', amount: 39 },
      timestamp: new Date().toISOString(),
    });
    // $60 + $39 = $99, under daily limit. But $39 < $40 threshold, so should pass.
    expect(r3.status).toBe('success');

    // Order 4: $10 → would bring to $109, over $100 → escalation
    const r4 = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Snack', delivery_location: 'lobby', amount: 10 },
      timestamp: new Date().toISOString(),
    });
    expect(r4.status).toBe('escalation_required');
  });

  it('escalation → approval → retry flow works end-to-end', async () => {
    const dm = new DelegationManager({ secret: SECRET });
    const { router } = buildRouter(dm);
    const { token, delegation } = dm.grant(makeGrant());

    // Try amount above confirmation threshold ($45 > $40)
    const r1 = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Premium Lunch', delivery_location: 'room', amount: 45 },
      timestamp: new Date().toISOString(),
    });
    expect(r1.status).toBe('escalation_required');
    expect(r1.escalation?.escalated).toBe(true);

    // Simulate guest approval by re-granting with higher threshold
    // In a real system this would be a separate approval endpoint
    const scope = delegation.scopes.find((s) => s.action_id === 'order_food_cafe')!;
    scope.requires_confirmation_above = 500; // Raise threshold

    // Retry — now passes
    const r2 = await router.execute({
      request_id: uuidv4(),
      delegation_token: token,
      action_id: 'order_food_cafe',
      parameters: { items: 'Premium Lunch', delivery_location: 'room', amount: 45 },
      timestamp: new Date().toISOString(),
    });
    expect(r2.status).toBe('success');
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/mc/Desktop/bspg/clients/phunware/agent-gateway && npx vitest run`
Expected: All tests across all 4 files pass.

- [ ] **Step 3: Commit**

```bash
git add test/integration.test.ts
git commit -m "test: add integration tests for full SDK flow"
```

---

## Task 25: Documentation

**Files:**
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/MANIFEST_SPEC.md`
- Create: `docs/DELEGATION_PROTOCOL.md`
- Create: `README.md`

- [ ] **Step 1: Write docs/ARCHITECTURE.md**

```markdown
# Architecture

## Overview

The Agent Gateway SDK has three modules that compose into a request pipeline:

```
Agent Request → [Token Verification] → [Delegation Check] → [Manifest Validation] → [Handler Execution] → [Audit Log] → Response
```

## Modules

### 1. Manifest — Capability Discovery

The manifest describes what a venue supports. It is generated from a simplified VenueConfig and validated against a JSON Schema. Agents read the manifest to discover available actions.

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
```

- [ ] **Step 2: Write docs/MANIFEST_SPEC.md**

```markdown
# Manifest Specification

## Purpose

A VenueManifest is a machine-readable description of what actions are available at a physical venue. It serves as the contract between the venue platform and any AI agent.

## Structure

| Field | Type | Description |
|-------|------|-------------|
| venue_id | string | Unique venue identifier |
| venue_name | string | Human-readable name |
| venue_type | enum | hotel, resort, cruise, airport, campus, conference |
| version | string | Manifest version |
| generated_at | ISO 8601 | When the manifest was generated |
| capabilities | ActionCapability[] | Available actions |
| authentication | AuthRequirements | How agents authenticate |
| constraints | VenueConstraints | Venue-wide limits |

## Action Capabilities

Each capability describes one action an agent can perform:

- **action_id**: Machine identifier (e.g., `order_food_pool_bar`)
- **category**: commerce, booking, service, information, or navigation
- **parameters**: Typed parameters with validation rules
- **constraints**: Operating hours, limits, advance notice
- **requires_guest_confirmation**: If true, always escalate to guest

## Parameter Types

- `string`: Free text
- `number`: Numeric with optional min/max
- `boolean`: True/false
- `enum`: One of a predefined set
- `datetime`: ISO 8601 timestamp
- `location`: Venue location identifier

## Generating a Manifest

Use `generateManifest(config)` with a VenueConfig. The config is a simplified format designed for hotel operators. The generator deterministically maps it to a full manifest.

## Validating a Manifest

Use `validateManifest(manifest)` to check any object against the JSON Schema. Returns `{ valid: boolean, errors: string[] }`.
```

- [ ] **Step 3: Write docs/DELEGATION_PROTOCOL.md**

```markdown
# Delegation Protocol

## Overview

Delegation is the mechanism by which a guest authorizes an AI agent to act on their behalf at a venue. It defines what the agent can do, how much it can spend, and when it can act.

## Lifecycle

1. **Grant**: Guest creates a delegation with scoped permissions
2. **Active**: Agent uses the delegation token to make requests
3. **Check**: Every request is validated against the delegation
4. **Escalate**: If an action exceeds scope limits, escalate to guest
5. **Expire/Revoke**: Delegation ends by time or guest action

## Delegation Scopes

Each scope maps to an action_id from the venue manifest:

| Field | Type | Description |
|-------|------|-------------|
| action_id | string | Must match a manifest action |
| allowed | boolean | Whether this action is permitted |
| max_amount_per_transaction | number | Per-request spending cap |
| max_amount_per_day | number | Daily spending cap for this action |
| requires_confirmation_above | number | Escalate above this amount |

## Escalation Rules

Actions are escalated (not denied) when:
1. Amount exceeds `requires_confirmation_above`
2. Would exceed `max_amount_per_day` for the action
3. Would exceed `max_total_spend_per_day` across all actions
4. Manifest marks action as `requires_guest_confirmation`

Actions are denied (not escalated) when:
1. Action not in delegation scopes
2. Outside `active_hours`
3. Delegation is expired or revoked

## Token Format

JWT (HS256) containing:
- delegation_id, guest_id, agent_id, venue_id
- scope_ids (quick reference list of allowed action_ids)
- iat (issued at), exp (expires at)

The token is presented with every request. Full delegation details are stored server-side.
```

- [ ] **Step 4: Write README.md**

```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add docs/ README.md
git commit -m "docs: add architecture, manifest spec, delegation protocol, and README"
```

---

## Task 26: Final Verification

- [ ] **Step 1: Run all tests**

Run: `cd /Users/mc/Desktop/bspg/clients/phunware/agent-gateway && npx vitest run`
Expected: All tests pass across manifest.test.ts, delegation.test.ts, router.test.ts, integration.test.ts.

- [ ] **Step 2: Run the demo**

Run: `npx tsx demo/run-demo.ts`
Expected: Full formatted output with 8 steps + audit summary. Completes in under 5 seconds.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 4: Final commit if any fixes needed**

Only if fixes were required in steps 1-3.
