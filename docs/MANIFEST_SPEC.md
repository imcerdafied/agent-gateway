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
