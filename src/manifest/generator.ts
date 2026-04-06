import type {
  VenueManifest,
  VenueConfig,
  ActionCapability,
  ActionParameter,
  ActionConstraint,
  VenueConstraints,
} from './types.js';

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

function buildFoodCapabilities(
  config: VenueConfig['features']['food_and_beverage']
): ActionCapability[] {
  if (!config) return [];
  return config.outlets.map((outlet) => {
    const parameters: ActionParameter[] = [
      {
        name: 'items',
        type: 'string',
        required: true,
        description: 'Items to order',
      },
      {
        name: 'delivery_location',
        type: 'enum',
        required: true,
        description: 'Location for delivery',
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
        description: 'Total order amount',
        min: 0,
        max: outlet.max_order_amount,
      },
    ];

    const constraints: ActionConstraint[] = [
      {
        type: 'hours',
        value: outlet.hours,
        description: `Available ${outlet.hours.open} - ${outlet.hours.close}`,
      },
      {
        type: 'max_amount',
        value: outlet.max_order_amount,
        description: `Maximum order amount is ${outlet.max_order_amount}`,
      },
    ];

    return {
      action_id: `order_food_${slugify(outlet.name)}`,
      category: 'commerce',
      name: `Order from ${outlet.name}`,
      description: `Place a food or beverage order from ${outlet.name}`,
      parameters,
      constraints,
      requires_guest_confirmation: false,
      estimated_fulfillment: '15-30 minutes',
    };
  });
}

function buildSpaCapability(
  config: VenueConfig['features']['spa']
): ActionCapability[] {
  if (!config) return [];

  const maxPrice = Math.max(...config.services.map((s) => s.price));
  const serviceNames = config.services.map((s) => s.name);

  const parameters: ActionParameter[] = [
    {
      name: 'service',
      type: 'enum',
      required: true,
      description: 'Spa service to book',
      enum_values: serviceNames,
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
      description: 'Payment amount',
      min: 0,
      max: maxPrice,
    },
  ];

  const constraints: ActionConstraint[] = [
    {
      type: 'hours',
      value: config.hours,
      description: `Available ${config.hours.open} - ${config.hours.close}`,
    },
    {
      type: 'advance_notice',
      value: config.advance_notice_hours,
      description: `Requires ${config.advance_notice_hours} hours advance notice`,
    },
  ];

  return [
    {
      action_id: 'book_spa',
      category: 'booking',
      name: 'Book Spa Appointment',
      description: 'Book a spa service appointment',
      parameters,
      constraints,
      requires_guest_confirmation: false,
      estimated_fulfillment: 'Confirmed immediately',
    },
  ];
}

function buildHousekeepingCapability(
  config: VenueConfig['features']['housekeeping']
): ActionCapability[] {
  if (!config) return [];

  const parameters: ActionParameter[] = [
    {
      name: 'service',
      type: 'enum',
      required: true,
      description: 'Type of housekeeping service',
      enum_values: config.services,
    },
    {
      name: 'location',
      type: 'string',
      required: true,
      description: 'Location for the service (e.g. room number)',
    },
    {
      name: 'notes',
      type: 'string',
      required: false,
      description: 'Additional notes or instructions',
    },
  ];

  const constraints: ActionConstraint[] = [
    {
      type: 'hours',
      value: config.hours,
      description: `Available ${config.hours.open} - ${config.hours.close}`,
    },
  ];

  return [
    {
      action_id: 'request_housekeeping',
      category: 'service',
      name: 'Request Housekeeping',
      description: 'Request a housekeeping service',
      parameters,
      constraints,
      requires_guest_confirmation: false,
      estimated_fulfillment: '20-40 minutes',
    },
  ];
}

function buildConciergeCapability(
  config: VenueConfig['features']['concierge']
): ActionCapability[] {
  if (!config) return [];

  const parameters: ActionParameter[] = [
    {
      name: 'query',
      type: 'string',
      required: true,
      description: 'The question or request for the concierge',
    },
    {
      name: 'category',
      type: 'enum',
      required: false,
      description: 'Category of the concierge request',
      enum_values: config.capabilities,
    },
  ];

  return [
    {
      action_id: 'concierge_query',
      category: 'information',
      name: 'Concierge Query',
      description: 'Ask the concierge for information or assistance',
      parameters,
      constraints: [],
      requires_guest_confirmation: false,
      estimated_fulfillment: 'Immediate',
    },
  ];
}

function buildActivityCapabilities(
  config: VenueConfig['features']['activities']
): ActionCapability[] {
  if (!config) return [];

  return config.items.map((activity) => {
    const parameters: ActionParameter[] = [
      {
        name: 'datetime',
        type: 'datetime',
        required: true,
        description: 'Requested date and time for the activity',
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
        description: 'Total payment amount',
        min: 0,
        max: activity.price * 10,
      },
    ];

    const constraints: ActionConstraint[] = [
      {
        type: 'advance_notice',
        value: activity.advance_notice_hours,
        description: `Requires ${activity.advance_notice_hours} hours advance notice`,
      },
    ];

    return {
      action_id: `book_activity_${slugify(activity.name)}`,
      category: 'booking',
      name: `Book ${activity.name}`,
      description: `Book the ${activity.name} activity`,
      parameters,
      constraints,
      requires_guest_confirmation: true,
      estimated_fulfillment: 'Confirmed within 1 hour',
    };
  });
}

export function generateManifest(config: VenueConfig): VenueManifest {
  const capabilities: ActionCapability[] = [
    ...buildFoodCapabilities(config.features.food_and_beverage),
    ...buildSpaCapability(config.features.spa),
    ...buildHousekeepingCapability(config.features.housekeeping),
    ...buildConciergeCapability(config.features.concierge),
    ...buildActivityCapabilities(config.features.activities),
  ];

  const constraintDefaults: VenueConstraints = {
    max_transaction_amount: 500,
    daily_transaction_limit: 1000,
    supported_currencies: [config.currency],
    timezone: config.timezone,
  };

  const constraints: VenueConstraints = {
    ...constraintDefaults,
    ...config.constraints,
  };

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
    constraints,
  };
}
