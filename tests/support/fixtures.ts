// Canned API responses. Shapes mirror frontend/src/types/index.ts.

export const testUser = {
  id: 'user-1',
  email: 'jane@example.com',
  name: 'Jane Tester',
  createdAt: '2026-01-01T00:00:00Z',
};

export const authResponse = { token: 'test-token', user: testUser };

export const usage = {
  subscriptionTier: 'free',
  usage: [{ feature: 'analysis', used: 1, limit: 5 }],
};

export const analysis = {
  compensationMentioned: '$150k-$170k base',
  jobType: 'Full-time, remote',
  redFlags: ['Vague client name'],
  questionsToAsk: ['Who is the end client?'],
  suggestedResponse: 'Thanks for reaching out — could you share the end client?',
  opportunityScore: 72,
};

export const reply = {
  reply: 'Hi Sam, thanks for thinking of me. I am interested in learning more.',
  tone: 'Professional',
};

export const comparison = {
  estimatedAnnualValueOne: 160000,
  estimatedAnnualValueTwo: 150000,
  prosOne: ['Higher base'],
  prosTwo: ['Shorter commute'],
  consOne: ['Longer commute'],
  consTwo: ['Lower base'],
  riskLevelOne: 'Low',
  riskLevelTwo: 'Medium',
  bestOffer: 'Acme Corp',
  recommendation: 'Acme Corp offers more total value.',
};
