import { mountKnowledgeOS } from '../knowledgeos-widget.js';
// Replace with your public KnowledgeOS origin, never a provider or integration secret.
const apiUrl = 'https://knowledge.example/api/v1';
mountKnowledgeOS({
  apiUrl,
  title: 'Company knowledge assistant',
  accent: '#2458ff',
  getToken: async () => {
    const sessionResponse = await fetch('/portal/me', {
      credentials: 'same-origin',
    });
    if (!sessionResponse.ok) throw new Error('Sign in to your intranet first.');
    const session = await sessionResponse.json();
    const response = await fetch('/portal/widget-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': session.csrf_token,
      },
      body: '{}',
    });
    if (!response.ok)
      throw new Error('Your intranet could not open the assistant.');
    return response.json();
  },
});
