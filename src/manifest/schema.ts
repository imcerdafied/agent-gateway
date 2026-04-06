export const venueManifestSchema = {
  type: 'object',
  additionalProperties: false,
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
  properties: {
    venue_id: { type: 'string' },
    venue_name: { type: 'string' },
    venue_type: {
      type: 'string',
      enum: ['hotel', 'resort', 'cruise', 'airport', 'campus', 'conference'],
    },
    version: { type: 'string' },
    generated_at: { type: 'string', format: 'date-time' },
    capabilities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
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
        properties: {
          action_id: { type: 'string' },
          category: {
            type: 'string',
            enum: ['commerce', 'booking', 'service', 'information', 'navigation'],
          },
          name: { type: 'string' },
          description: { type: 'string' },
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'type', 'required', 'description'],
              properties: {
                name: { type: 'string' },
                type: {
                  type: 'string',
                  enum: ['string', 'number', 'boolean', 'enum', 'datetime', 'location'],
                },
                required: { type: 'boolean' },
                description: { type: 'string' },
                enum_values: {
                  oneOf: [
                    { type: 'array', items: { type: 'string' } },
                    { type: 'null' },
                  ],
                },
                min: {
                  oneOf: [{ type: 'number' }, { type: 'null' }],
                },
                max: {
                  oneOf: [{ type: 'number' }, { type: 'null' }],
                },
                default: true,
              },
            },
          },
          constraints: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'value', 'description'],
              properties: {
                type: {
                  type: 'string',
                  enum: [
                    'hours',
                    'max_amount',
                    'location_required',
                    'advance_notice',
                    'availability',
                  ],
                },
                value: true,
                description: { type: 'string' },
              },
            },
          },
          requires_guest_confirmation: { type: 'boolean' },
          estimated_fulfillment: { type: 'string' },
        },
      },
    },
    authentication: {
      type: 'object',
      additionalProperties: false,
      required: ['delegation_required', 'supported_protocols', 'token_endpoint'],
      properties: {
        delegation_required: { type: 'boolean' },
        supported_protocols: {
          type: 'array',
          items: { type: 'string' },
        },
        token_endpoint: { type: 'string' },
      },
    },
    constraints: {
      type: 'object',
      additionalProperties: false,
      required: [
        'max_transaction_amount',
        'daily_transaction_limit',
        'supported_currencies',
        'timezone',
      ],
      properties: {
        max_transaction_amount: { type: 'number', minimum: 0 },
        daily_transaction_limit: { type: 'number', minimum: 0 },
        supported_currencies: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
        },
        timezone: { type: 'string' },
      },
    },
  },
} as const;
