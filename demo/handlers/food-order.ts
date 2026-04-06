import type { ActionHandler } from '../../src/router/types.js';

let orderCounter = 1000;

export const foodOrderHandler: ActionHandler = async (params) => {
  const orderId = `ORD-${++orderCounter}`;
  return {
    success: true,
    result: {
      order_id: orderId,
      items: params.items,
      delivery_location: params.delivery_location,
      amount: params.amount,
      estimated_delivery: '15-20 minutes',
      special_instructions: params.special_instructions ?? null,
    },
  };
};
