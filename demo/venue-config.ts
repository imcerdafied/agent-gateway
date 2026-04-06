import type { VenueConfig } from '../src/manifest/types.js';

export const resortConfig: VenueConfig = {
  venue_id: 'paradise-resort-001',
  venue_name: 'Paradise Resort & Spa',
  venue_type: 'resort',
  timezone: 'America/Nassau',
  currency: 'USD',
  features: {
    food_and_beverage: {
      outlets: [
        {
          name: 'Pool Bar',
          menu_categories: ['cocktails', 'beer', 'snacks', 'lunch'],
          hours: { open: '00:00', close: '23:59' },
          delivery_locations: ['pool', 'beach', 'cabana'],
          max_order_amount: 75,
        },
        {
          name: 'Ocean Grill',
          menu_categories: ['lunch', 'dinner', 'seafood', 'wine'],
          hours: { open: '00:00', close: '23:59' },
          delivery_locations: ['restaurant', 'room'],
          max_order_amount: 200,
        },
        {
          name: 'The Steakhouse',
          menu_categories: ['steak', 'fine dining', 'premium wine'],
          hours: { open: '00:00', close: '23:59' },
          delivery_locations: ['restaurant'],
          max_order_amount: 500,
        },
      ],
    },
    spa: {
      services: [
        { name: 'Express Massage', duration_minutes: 30, price: 80 },
        { name: 'Deep Tissue', duration_minutes: 60, price: 150 },
        { name: 'Hot Stone', duration_minutes: 75, price: 200 },
        { name: 'Couples Relaxation Package', duration_minutes: 90, price: 350 },
      ],
      hours: { open: '00:00', close: '23:59' },
      advance_notice_hours: 2,
    },
    housekeeping: {
      services: ['towels', 'cleaning', 'turndown', 'minibar'],
      hours: { open: '00:00', close: '23:59' },
    },
    concierge: {
      capabilities: ['directions', 'recommendations', 'reservations', 'information'],
    },
    activities: {
      items: [
        { name: 'Sunset Sailing', price: 150, advance_notice_hours: 24 },
        { name: 'Snorkel Tour', price: 85, advance_notice_hours: 4 },
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

export const minimalHotelConfig: VenueConfig = {
  venue_id: 'city-hotel-001',
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
