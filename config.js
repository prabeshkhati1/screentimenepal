// Edit these values before accepting orders. Numbers are NPR, indexed by duration in months.
export const config = {
  whatsappNumber: '', // Country code + number, digits only; e.g. 97798XXXXXXXX
  instagramUrl: '', // Optional full URL to your real business profile
  products: [
    { id: 'netflix', name: 'Netflix', category: 'Film & series', line: 'Your next watch starts here.', prices: { 1: 499, 2: 899, 3: 1399 } },
    { id: 'prime', name: 'Prime Video', category: 'Film & series', line: 'A whole world of watching.', prices: { 1: 199, 2: 379, 3: 549 } },
    { id: 'spotify', name: 'Spotify', category: 'Music & podcasts', line: 'Good music, on repeat.', prices: { 1: 549, 2: 999, 3: 1499 } },
    { id: 'claude', name: 'Claude', category: 'AI & productivity', line: 'More room for your ideas.', prices: { 1: 3699, 2: 7299, 3: 10799 } },
  ],
};
