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
