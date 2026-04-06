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
