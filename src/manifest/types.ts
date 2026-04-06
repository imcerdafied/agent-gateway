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
