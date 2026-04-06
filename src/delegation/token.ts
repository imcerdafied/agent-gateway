import jwt from 'jsonwebtoken';
import type { Delegation, TokenPayload } from './types.js';

export function signToken(delegation: Delegation, secret: string): string {
  const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
    delegation_id: delegation.delegation_id,
    guest_id: delegation.guest_id,
    agent_id: delegation.agent_id,
    venue_id: delegation.venue_id,
    scope_ids: delegation.scopes.filter((s) => s.allowed).map((s) => s.action_id),
  };
  return jwt.sign(payload, secret, {
    expiresIn: Math.floor((new Date(delegation.expires_at).getTime() - Date.now()) / 1000),
  });
}

export function verifyToken(token: string, secret: string): { valid: boolean; payload?: TokenPayload; error?: string } {
  try {
    const payload = jwt.verify(token, secret) as TokenPayload;
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Token verification failed' };
  }
}

export function decodeToken(token: string): TokenPayload {
  return jwt.decode(token) as TokenPayload;
}
