// Edit these values before accepting orders. Each plan is 'label': price in NPR.
// `term` is the access period for plans whose label isn't a duration (e.g. Shared/Private).
// Each product's logo lives at assets/<id>.svg.
export const config = {
  whatsappNumber: '', // Country code + number, digits only; e.g. 97798XXXXXXXX
  instagramUrl: 'https://www.instagram.com/screentimenp/', // Your business profile, or '' to hide
  products: [
    { id: 'netflix', name: 'Netflix', category: 'Film & series', line: 'Your next watch starts here.', plans: { '1 month': 499, '2 months': 899, '3 months': 1399 } },
    { id: 'prime', name: 'Prime Video', category: 'Film & series', line: 'A whole world of watching.', plans: { '1 month': 199, '2 months': 379, '3 months': 549 } },
    { id: 'spotify', name: 'Spotify', category: 'Music & podcasts', line: 'Good music, on repeat.', plans: { '1 month': 549, '2 months': 999, '3 months': 1499 } },
    { id: 'claude', name: 'Claude', category: 'AI & productivity', line: 'More room for your ideas.', plans: { '1 month': 3699, '2 months': 7299, '3 months': 10799 } },
    { id: 'gemini-ai-pro', name: 'Gemini AI Pro', category: 'AI & productivity', line: 'Your AI assistant, supercharged.', term: '18 months', note: 'Pick the Shared plan for the best value, or a Private profile for a more personal experience. Account setup depends on the plan.', plans: { 'Shared plan': 499, 'Private profile': 999 } },
    { id: 'duolingo-super', name: 'Duolingo Super', category: 'Language learning', line: 'Learn faster. Go further.', note: 'No ads, unlimited hearts and personalized practice.', plans: { '12 months': 999 } },
  ],
};
