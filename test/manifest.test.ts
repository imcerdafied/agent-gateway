import { describe, it, expect } from 'vitest';
import { generateManifest } from '../src/manifest/generator.js';
import { validateManifest } from '../src/manifest/validator.js';
import type { VenueConfig } from '../src/manifest/types.js';

const fullResortConfig: VenueConfig = {
  venue_id: 'resort-001',
  venue_name: 'Paradise Resort & Spa',
  venue_type: 'resort',
  timezone: 'America/Nassau',
  currency: 'USD',
  features: {
    food_and_beverage: {
      outlets: [
        {
          name: 'Pool Bar',
          menu_categories: ['drinks', 'snacks', 'lunch'],
          hours: { open: '10:00', close: '22:00' },
          delivery_locations: ['pool', 'beach', 'cabana'],
          max_order_amount: 75,
        },
        {
          name: 'Ocean Grill',
          menu_categories: ['lunch', 'dinner', 'wine'],
          hours: { open: '11:00', close: '23:00' },
          delivery_locations: ['restaurant', 'room'],
          max_order_amount: 200,
        },
      ],
    },
    spa: {
      services: [
        { name: 'Swedish Massage', duration_minutes: 30, price: 80 },
        { name: 'Couples Relaxation Package', duration_minutes: 90, price: 350 },
      ],
      hours: { open: '08:00', close: '20:00' },
      advance_notice_hours: 2,
    },
    housekeeping: {
      services: ['towels', 'cleaning', 'turndown', 'minibar'],
      hours: { open: '06:00', close: '23:00' },
    },
    concierge: {
      capabilities: ['directions', 'recommendations', 'reservations', 'information'],
    },
    activities: {
      items: [
        { name: 'Sunset Sailing', price: 150, advance_notice_hours: 24 },
      ],
    },
  },
  constraints: {
    max_transaction_amount: 500,
    daily_transaction_limit: 1000,
    supported_currencies: ['USD'],
    timezone: 'America/Nassau',
  },
};

const minimalConfig: VenueConfig = {
  venue_id: 'hotel-001',
  venue_name: 'City Hotel',
  venue_type: 'hotel',
  timezone: 'America/New_York',
  currency: 'USD',
  features: {
    housekeeping: {
      services: ['towels', 'cleaning'],
      hours: { open: '07:00', close: '22:00' },
    },
    concierge: {
      capabilities: ['directions', 'information'],
    },
  },
};

describe('Manifest Generator', () => {
  it('produces valid manifest from full resort config', () => {
    const manifest = generateManifest(fullResortConfig);
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('produces valid manifest from minimal config', () => {
    const manifest = generateManifest(minimalConfig);
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('has correct action count based on enabled features', () => {
    const manifest = generateManifest(fullResortConfig);
    // 2 food outlets + 1 spa + 1 housekeeping + 1 concierge + 1 activity = 6
    expect(manifest.capabilities).toHaveLength(6);
  });

  it('minimal config produces only housekeeping and concierge', () => {
    const manifest = generateManifest(minimalConfig);
    expect(manifest.capabilities).toHaveLength(2);
    const ids = manifest.capabilities.map((c) => c.action_id);
    expect(ids).toContain('request_housekeeping');
    expect(ids).toContain('concierge_query');
  });

  it('sets venue metadata correctly', () => {
    const manifest = generateManifest(fullResortConfig);
    expect(manifest.venue_id).toBe('resort-001');
    expect(manifest.venue_name).toBe('Paradise Resort & Spa');
    expect(manifest.venue_type).toBe('resort');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.constraints.timezone).toBe('America/Nassau');
  });
});

describe('Manifest Validator', () => {
  it('accepts a valid manifest', () => {
    const manifest = generateManifest(fullResortConfig);
    expect(validateManifest(manifest).valid).toBe(true);
  });

  it('rejects manifest with missing required fields', () => {
    const result = validateManifest({ venue_id: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects manifest with invalid venue_type', () => {
    const manifest = generateManifest(fullResortConfig);
    const bad = { ...manifest, venue_type: 'spaceship' };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('venue_type'))).toBe(true);
  });

  it('rejects manifest with invalid action parameter type', () => {
    const manifest = generateManifest(minimalConfig);
    const bad = JSON.parse(JSON.stringify(manifest));
    bad.capabilities[0].parameters[0].type = 'invalid_type';
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
  });
});
