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
