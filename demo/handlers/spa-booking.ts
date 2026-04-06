import type { ActionHandler } from '../../src/router/types.js';

const bookedSlots = new Set<string>();
let bookingCounter = 2800;

export const spaBookingHandler: ActionHandler = async (params) => {
  const slotKey = `${params.service}-${params.datetime}`;
  if (bookedSlots.has(slotKey)) {
    return { success: false, error: `${params.service} is not available at the requested time` };
  }
  bookedSlots.add(slotKey);
  const bookingId = `SP-${++bookingCounter}`;
  return {
    success: true,
    result: {
      booking_id: bookingId,
      service: params.service,
      datetime: params.datetime,
      amount: params.amount,
      status: 'confirmed',
    },
  };
};
