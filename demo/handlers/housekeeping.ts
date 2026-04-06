import type { ActionHandler } from '../../src/router/types.js';

export const housekeepingHandler: ActionHandler = async (params) => {
  return {
    success: true,
    result: {
      service: params.service,
      location: params.location,
      estimated_arrival: '10-15 minutes',
      status: 'dispatched',
    },
  };
};
