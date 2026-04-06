import { v4 as uuidv4 } from 'uuid';
import type { VenueManifest } from '../manifest/types.js';
import type { DelegationManager } from '../delegation/manager.js';
import type { ActionRequest, ActionResponse, AuditEntry, ActionHandler } from './types.js';
import { AuditLog } from './audit.js';

export class ActionRouter {
  private manifest: VenueManifest;
  private delegationManager: DelegationManager;
  private handlers: Map<string, ActionHandler>;
  private auditLog: AuditLog;

  constructor(options: {
    manifest: VenueManifest;
    delegationManager: DelegationManager;
    handlers: Map<string, ActionHandler>;
  }) {
    this.manifest = options.manifest;
    this.delegationManager = options.delegationManager;
    this.handlers = options.handlers;
    this.auditLog = new AuditLog();
  }

  async execute(request: ActionRequest): Promise<ActionResponse> {
    const startTime = Date.now();
    const audit_id = uuidv4();
    const timestamp = new Date().toISOString();

    // Extract amount from parameters
    const amount =
      typeof request.parameters.amount === 'number' && request.parameters.amount > 0
        ? request.parameters.amount
        : undefined;

    // Helper to build response and log audit entry
    const respond = (
      status: ActionResponse['status'],
      extra: Partial<ActionResponse> & { delegation_id?: string; guest_id?: string; agent_id?: string; venue_id?: string } = {}
    ): ActionResponse => {
      const entry: AuditEntry = {
        audit_id,
        request_id: request.request_id,
        delegation_id: extra.delegation_id ?? '',
        guest_id: extra.guest_id ?? '',
        agent_id: extra.agent_id ?? '',
        venue_id: extra.venue_id ?? '',
        action_id: request.action_id,
        parameters: request.parameters,
        status,
        amount,
        escalation: extra.escalation,
        error: extra.error,
        timestamp,
        duration_ms: Date.now() - startTime,
      };
      this.auditLog.append(entry);

      const response: ActionResponse = {
        request_id: request.request_id,
        status,
        action_id: request.action_id,
        timestamp,
        audit_id,
      };
      if (extra.result !== undefined) response.result = extra.result;
      if (extra.escalation !== undefined) response.escalation = extra.escalation;
      if (extra.error !== undefined) response.error = extra.error;
      return response;
    };

    // Step 1: Verify delegation
    let checkResult: ReturnType<DelegationManager['check']>;
    try {
      checkResult = this.delegationManager.check(request.delegation_token, request.action_id, amount);
    } catch (err) {
      return respond('denied', {
        error: { code: 'DELEGATION_INVALID', message: err instanceof Error ? err.message : 'Invalid delegation token' },
      });
    }

    const { permitted, delegation, escalation, reason } = checkResult;

    if (!permitted) {
      if (escalation?.escalated) {
        return respond('escalation_required', {
          delegation_id: delegation.delegation_id,
          guest_id: delegation.guest_id,
          agent_id: delegation.agent_id,
          venue_id: delegation.venue_id,
          escalation,
        });
      }
      return respond('denied', {
        delegation_id: delegation.delegation_id,
        guest_id: delegation.guest_id,
        agent_id: delegation.agent_id,
        venue_id: delegation.venue_id,
        error: { code: 'DELEGATION_DENIED', message: reason ?? 'Action not permitted by delegation' },
      });
    }

    // Step 2: Validate action_id exists in manifest
    const capability = this.manifest.capabilities.find((c) => c.action_id === request.action_id);
    if (!capability) {
      return respond('not_found', {
        delegation_id: delegation.delegation_id,
        guest_id: delegation.guest_id,
        agent_id: delegation.agent_id,
        venue_id: delegation.venue_id,
        error: { code: 'ACTION_NOT_FOUND', message: `Action '${request.action_id}' not found in manifest` },
      });
    }

    // Step 3: Validate parameters against manifest
    for (const param of capability.parameters) {
      const value = request.parameters[param.name];

      if (param.required && (value === undefined || value === null)) {
        return respond('error', {
          delegation_id: delegation.delegation_id,
          guest_id: delegation.guest_id,
          agent_id: delegation.agent_id,
          venue_id: delegation.venue_id,
          error: { code: 'PARAMETER_VALIDATION_ERROR', message: `Required parameter '${param.name}' is missing` },
        });
      }

      if (value === undefined || value === null) continue;

      // Type validation
      if (param.type === 'string' || param.type === 'datetime' || param.type === 'location') {
        if (typeof value !== 'string') {
          return respond('error', {
            delegation_id: delegation.delegation_id,
            guest_id: delegation.guest_id,
            agent_id: delegation.agent_id,
            venue_id: delegation.venue_id,
            error: { code: 'PARAMETER_VALIDATION_ERROR', message: `Parameter '${param.name}' must be a string` },
          });
        }
      } else if (param.type === 'number') {
        if (typeof value !== 'number') {
          return respond('error', {
            delegation_id: delegation.delegation_id,
            guest_id: delegation.guest_id,
            agent_id: delegation.agent_id,
            venue_id: delegation.venue_id,
            error: { code: 'PARAMETER_VALIDATION_ERROR', message: `Parameter '${param.name}' must be a number` },
          });
        }
        if (param.min !== undefined && value < param.min) {
          return respond('error', {
            delegation_id: delegation.delegation_id,
            guest_id: delegation.guest_id,
            agent_id: delegation.agent_id,
            venue_id: delegation.venue_id,
            error: { code: 'PARAMETER_VALIDATION_ERROR', message: `Parameter '${param.name}' must be >= ${param.min}` },
          });
        }
        if (param.max !== undefined && value > param.max) {
          return respond('error', {
            delegation_id: delegation.delegation_id,
            guest_id: delegation.guest_id,
            agent_id: delegation.agent_id,
            venue_id: delegation.venue_id,
            error: { code: 'PARAMETER_VALIDATION_ERROR', message: `Parameter '${param.name}' must be <= ${param.max}` },
          });
        }
      } else if (param.type === 'boolean') {
        if (typeof value !== 'boolean') {
          return respond('error', {
            delegation_id: delegation.delegation_id,
            guest_id: delegation.guest_id,
            agent_id: delegation.agent_id,
            venue_id: delegation.venue_id,
            error: { code: 'PARAMETER_VALIDATION_ERROR', message: `Parameter '${param.name}' must be a boolean` },
          });
        }
      } else if (param.type === 'enum') {
        if (typeof value !== 'string') {
          return respond('error', {
            delegation_id: delegation.delegation_id,
            guest_id: delegation.guest_id,
            agent_id: delegation.agent_id,
            venue_id: delegation.venue_id,
            error: { code: 'PARAMETER_VALIDATION_ERROR', message: `Parameter '${param.name}' must be a string` },
          });
        }
        if (param.enum_values && !param.enum_values.includes(value)) {
          return respond('error', {
            delegation_id: delegation.delegation_id,
            guest_id: delegation.guest_id,
            agent_id: delegation.agent_id,
            venue_id: delegation.venue_id,
            error: { code: 'PARAMETER_VALIDATION_ERROR', message: `Parameter '${param.name}' must be one of: ${param.enum_values.join(', ')}` },
          });
        }
      }
    }

    // Step 4: Look up handler
    const handler = this.handlers.get(request.action_id);
    if (!handler) {
      return respond('error', {
        delegation_id: delegation.delegation_id,
        guest_id: delegation.guest_id,
        agent_id: delegation.agent_id,
        venue_id: delegation.venue_id,
        error: { code: 'HANDLER_NOT_FOUND', message: `No handler registered for action '${request.action_id}'` },
      });
    }

    // Step 5: Call handler
    let handlerResult: { success: boolean; result?: unknown; error?: string };
    try {
      handlerResult = await handler(request.parameters, {
        guest_id: delegation.guest_id,
        agent_id: delegation.agent_id,
        venue_id: delegation.venue_id,
        delegation,
      });
    } catch (err) {
      return respond('error', {
        delegation_id: delegation.delegation_id,
        guest_id: delegation.guest_id,
        agent_id: delegation.agent_id,
        venue_id: delegation.venue_id,
        error: { code: 'HANDLER_ERROR', message: err instanceof Error ? err.message : 'Handler threw an error' },
      });
    }

    if (!handlerResult.success) {
      return respond('error', {
        delegation_id: delegation.delegation_id,
        guest_id: delegation.guest_id,
        agent_id: delegation.agent_id,
        venue_id: delegation.venue_id,
        error: { code: 'HANDLER_ERROR', message: handlerResult.error ?? 'Handler reported failure' },
      });
    }

    // Step 6: Record transaction if amount present
    if (amount !== undefined) {
      this.delegationManager.recordTransaction(delegation.delegation_id, request.action_id, amount);
    }

    // Step 7 & 8: Log and return success
    return respond('success', {
      delegation_id: delegation.delegation_id,
      guest_id: delegation.guest_id,
      agent_id: delegation.agent_id,
      venue_id: delegation.venue_id,
      result: handlerResult.result,
    });
  }

  getAuditLog(): AuditLog {
    return this.auditLog;
  }
}
