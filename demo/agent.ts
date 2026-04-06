export interface StepResult {
  step: number;
  title: string;
  emoji: string;
  details: string[];
  delegation_check?: string;
  result: Record<string, unknown>;
}

async function post(baseUrl: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

async function get(baseUrl: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function runAgentSimulation(baseUrl: string): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // Step 1: DISCOVER
  const manifest = await get(baseUrl, '/manifest') as {
    venue_name: string;
    capabilities: Array<{ action_id: string; category: string }>;
  };
  const categories = [...new Set(manifest.capabilities.map((c) => c.category))];
  results.push({
    step: 1,
    title: 'DISCOVER CAPABILITIES',
    emoji: '🔍',
    details: [
      `Venue: ${manifest.venue_name}`,
      `Total actions available: ${manifest.capabilities.length}`,
      `Categories: ${categories.join(', ')}`,
      `Actions: ${manifest.capabilities.map((c) => c.action_id).join(', ')}`,
    ],
    result: { venue_name: manifest.venue_name, action_count: manifest.capabilities.length, categories },
  });

  // Step 2: DELEGATE
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const delegateResult = await post(baseUrl, '/delegate', {
    guest_id: 'guest-suite-42',
    agent_id: 'resort-ai-agent-v1',
    venue_id: 'paradise-resort-001',
    duration_hours: 72,
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
        max_amount_per_day: 500,
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
  }) as { delegation: { delegation_id: string; expires_at: string }; token: string };

  const { delegation, token } = delegateResult;

  results.push({
    step: 2,
    title: 'GET DELEGATED ACCESS',
    emoji: '🔐',
    details: [
      `Delegation ID: ${delegation.delegation_id}`,
      `Guest: guest-suite-42 | Agent: resort-ai-agent-v1`,
      `Scopes granted: food orders (3 outlets), spa, housekeeping, concierge`,
      `Activities NOT included in delegation`,
      `Daily spend limit: $1,000 | Token valid for: 72 hours`,
      `Expires: ${new Date(delegation.expires_at).toLocaleString()}`,
    ],
    result: { delegation_id: delegation.delegation_id, expires_at: delegation.expires_at },
  });

  // Step 3: ORDER FOOD
  const foodOrder = await post(baseUrl, '/action', {
    delegation_token: token,
    action_id: 'order_food_pool_bar',
    parameters: {
      items: 'Lobster Roll, Cold Beer',
      delivery_location: 'pool',
      amount: 57,
    },
  }) as { status: string; result?: { order_id?: string; estimated_delivery?: string } };

  results.push({
    step: 3,
    title: 'ORDER FOOD (Pool Bar)',
    emoji: '🍔',
    details: [
      `Action: order_food_pool_bar`,
      `Items: Lobster Roll, Cold Beer`,
      `Delivery: pool | Amount: $57`,
      `Status: ${foodOrder.status}`,
      foodOrder.result?.order_id ? `Order ID: ${foodOrder.result.order_id}` : '',
      foodOrder.result?.estimated_delivery ? `ETA: ${foodOrder.result.estimated_delivery}` : '',
    ].filter(Boolean),
    delegation_check: 'PERMITTED — $57 within $100/tx limit, $57 of $300/day food budget used',
    result: foodOrder,
  });

  // Step 4: HOUSEKEEPING
  const hkResult = await post(baseUrl, '/action', {
    delegation_token: token,
    action_id: 'request_housekeeping',
    parameters: {
      service: 'towels',
      location: 'Pool Deck',
    },
  }) as { status: string; result?: { status?: string; estimated_arrival?: string } };

  results.push({
    step: 4,
    title: 'REQUEST HOUSEKEEPING',
    emoji: '🛎️',
    details: [
      `Action: request_housekeeping`,
      `Service: towels | Location: Pool Deck`,
      `Status: ${hkResult.status}`,
      hkResult.result?.status ? `Service status: ${hkResult.result.status}` : '',
      hkResult.result?.estimated_arrival ? `Arrival in: ${hkResult.result.estimated_arrival}` : '',
    ].filter(Boolean),
    delegation_check: 'PERMITTED — housekeeping in scope, no amount limits',
    result: hkResult,
  });

  // Step 5: CONCIERGE
  const conciergeResult = await post(baseUrl, '/action', {
    delegation_token: token,
    action_id: 'concierge_query',
    parameters: {
      query: 'Best dinner option for a couple tonight?',
    },
  }) as { status: string; result?: { response?: string } };

  results.push({
    step: 5,
    title: 'CONCIERGE QUERY',
    emoji: '🎩',
    details: [
      `Action: concierge_query`,
      `Query: "Best dinner option for a couple tonight?"`,
      `Status: ${conciergeResult.status}`,
      conciergeResult.result?.response ? `Response: ${conciergeResult.result.response}` : '',
    ].filter(Boolean),
    delegation_check: 'PERMITTED — concierge in scope',
    result: conciergeResult,
  });

  // Step 6: SPA ESCALATION
  const spaDatetime = `${tomorrowStr}T14:00:00`;
  const spaResult = await post(baseUrl, '/action', {
    delegation_token: token,
    action_id: 'book_spa',
    parameters: {
      service: 'Couples Relaxation Package',
      datetime: spaDatetime,
      amount: 350,
    },
  }) as {
    status: string;
    escalation?: { reason?: string; requires_guest_action?: string };
  };

  results.push({
    step: 6,
    title: 'SPA BOOKING — ESCALATION',
    emoji: '🧖',
    details: [
      `Action: book_spa`,
      `Service: Couples Relaxation Package | Amount: $350`,
      `Datetime: ${spaDatetime}`,
      `Status: ${spaResult.status}`,
      spaResult.escalation?.reason ? `Escalation reason: ${spaResult.escalation.reason}` : '',
      spaResult.escalation?.requires_guest_action ? `Required action: guest must ${spaResult.escalation.requires_guest_action}` : '',
      `[Guest approves] → Guest reviews and approves the $350 spa booking`,
    ].filter(Boolean),
    delegation_check: 'ESCALATED — $350 exceeds $150 confirmation threshold, requires guest approval',
    result: spaResult,
  });

  // Step 7: ACTIVITY DENIED (not in scope)
  const activityResult = await post(baseUrl, '/action', {
    delegation_token: token,
    action_id: 'book_activity_sunset_sailing',
    parameters: {
      datetime: `${tomorrowStr}T17:00:00`,
      guests: 2,
      amount: 150,
    },
  }) as { status: string; error?: { code?: string; message?: string } };

  results.push({
    step: 7,
    title: 'BOOK ACTIVITY — DENIED',
    emoji: '⛵',
    details: [
      `Action: book_activity_sunset_sailing`,
      `Datetime: ${tomorrowStr}T17:00:00 | Guests: 2 | Amount: $150`,
      `Status: ${activityResult.status}`,
      activityResult.error?.code ? `Error code: ${activityResult.error.code}` : '',
      activityResult.error?.message ? `Reason: ${activityResult.error.message}` : '',
    ].filter(Boolean),
    delegation_check: 'DENIED — activities not included in delegation scopes',
    result: activityResult,
  });

  // Step 8: FOOD LIMIT (would exceed daily food budget)
  const foodLimit = await post(baseUrl, '/action', {
    delegation_token: token,
    action_id: 'order_food_ocean_grill',
    parameters: {
      items: 'Seafood Platter, Bottle of Sauvignon Blanc',
      delivery_location: 'room',
      amount: 285,
    },
  }) as {
    status: string;
    escalation?: { reason?: string };
    error?: { message?: string };
  };

  results.push({
    step: 8,
    title: 'FOOD ORDER — DAILY LIMIT ESCALATION',
    emoji: '🦞',
    details: [
      `Action: order_food_ocean_grill`,
      `Items: Seafood Platter, Bottle of Sauvignon Blanc`,
      `Delivery: room | Amount: $285`,
      `Previous food spend today: $57 (Pool Bar)`,
      `This order would bring food total to $342 — over $300/day limit`,
      `Status: ${foodLimit.status}`,
      foodLimit.escalation?.reason ? `Escalation: ${foodLimit.escalation.reason}` : '',
      foodLimit.error?.message ? `Reason: ${foodLimit.error.message}` : '',
    ].filter(Boolean),
    delegation_check: 'ESCALATED — $57 + $285 = $342 exceeds $300/day food limit',
    result: foodLimit,
  });

  return results;
}

export async function getAuditSummary(baseUrl: string): Promise<Record<string, unknown>> {
  return get(baseUrl, '/audit/summary');
}
