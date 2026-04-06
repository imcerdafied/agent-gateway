import type { ActionHandler } from '../../src/router/types.js';

const responses: Record<string, string> = {
  dinner: 'The Steakhouse has availability at 7:30pm and 8:15pm tonight. Known for their dry-aged ribeye and ocean views. Reservations recommended.',
  restaurant: 'We have three dining options: Pool Bar (casual, 10am-10pm), Ocean Grill (seafood, 11am-11pm), and The Steakhouse (fine dining, 5pm-11pm).',
  pool: 'The main pool is open 7am-9pm. Towel service is available poolside. The Pool Bar serves drinks and light fare from 10am.',
  spa: 'The spa is open 8am-8pm. Popular services include the Express Massage ($80, 30min) and Couples Relaxation Package ($350, 90min). Book at least 2 hours in advance.',
  directions: 'The resort is located on Paradise Island. The main lobby is on the ground floor. Pool access is through the east wing.',
  beach: 'The private beach is a 2-minute walk from the pool area. Beach chairs and umbrellas are complimentary. Water sports desk is open 9am-5pm.',
};

export const conciergeQueryHandler: ActionHandler = async (params) => {
  const query = (params.query as string).toLowerCase();
  let response = 'I can help with directions, restaurant recommendations, pool and spa hours, beach information, and more. What would you like to know?';
  for (const [keyword, answer] of Object.entries(responses)) {
    if (query.includes(keyword)) {
      response = answer;
      break;
    }
  }
  return { success: true, result: { response } };
};
