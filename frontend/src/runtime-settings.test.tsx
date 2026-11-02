import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RuntimeSettingsPanel, {
  type RuntimeSettings,
} from './RuntimeSettingsPanel';
let settings: RuntimeSettings;
let patches: Record<string, unknown>[];
let failSave: boolean;
let failLoad: boolean;
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <RuntimeSettingsPanel />
    </QueryClientProvider>,
  );
  return cache;
}
beforeEach(() => {
  settings = {
    default_top_k: 5,
    default_score_threshold: 0.3,
    llm_provider: 'none',
    llm_model: '',
    allowed_providers: ['none', 'gemini', 'openai', 'ollama'],
    configured_providers: {
      none: true,
      gemini: false,
      openai: false,
      ollama: false,
    },
    embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
    embedding_dimension: 384,
    status_note:
      'Configuration status only; live access/quotas require real request',
  };
  patches = [];
  failSave = false;
  failLoad = false;
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) !== '/api/admin/settings')
        throw new Error('Unexpected settings request');
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        patches.push(body);
        if (failSave)
          return new Response(
            JSON.stringify({
              detail: 'Provider is not configured on the server',
            }),
            { status: 422 },
          );
        settings = { ...settings, ...body };
      } else if (failLoad)
        return new Response(
          JSON.stringify({ detail: 'Settings unavailable' }),
          { status: 503 },
        );
      return new Response(JSON.stringify(settings));
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('loads server defaults and disables unconfigured providers without exposing key fields', async () => {
  mount();
  expect(
    await screen.findByLabelText('Server maximum source passages'),
  ).toHaveValue(5);
  expect(screen.getByLabelText('Server minimum relevance score')).toHaveValue(
    0.3,
  );
  expect(
    screen.getByRole('option', {
      name: 'gemini · server configuration required',
    }),
  ).toBeDisabled();
  expect(screen.getByLabelText('Generation provider')).toHaveValue('none');
  expect(screen.queryByLabelText(/API key/i)).not.toBeInTheDocument();
  expect(
    screen.getByText(
      'Configuration status only; live access/quotas require real request',
    ),
  ).toBeVisible();
  expect(patches).toHaveLength(0);
});
it('persists validated defaults to the backend without modifying browser Playground overrides', async () => {
  const user = userEvent.setup();
  localStorage.setItem('knowledgeos-top-k', '8');
  mount();
  const passages = await screen.findByLabelText(
    'Server maximum source passages',
  );
  await user.clear(passages);
  await user.type(passages, '3');
  const score = screen.getByLabelText('Server minimum relevance score');
  await user.clear(score);
  await user.type(score, '0.45');
  await user.click(
    screen.getByRole('button', { name: 'Save server defaults' }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Server defaults saved.',
  );
  expect(patches).toEqual([
    {
      default_top_k: 3,
      default_score_threshold: 0.45,
      llm_provider: 'none',
      llm_model: '',
    },
  ]);
  expect(localStorage.getItem('knowledgeos-top-k')).toBe('8');
  expect(localStorage.getItem('knowledgeos-threshold')).toBeNull();
});
it('blocks invalid retrieval bounds without submitting a PATCH', async () => {
  const user = userEvent.setup();
  mount();
  const passages = await screen.findByLabelText(
    'Server maximum source passages',
  );
  await user.clear(passages);
  await user.type(passages, '11');
  expect(
    screen.getByRole('button', { name: 'Save server defaults' }),
  ).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Use 1–10 whole passages',
  );
  expect(patches).toHaveLength(0);
});
it('requires an explicit model when a configured generative provider is selected', async () => {
  const user = userEvent.setup();
  settings.configured_providers.gemini = true;
  mount();
  await screen.findByLabelText('Generation provider');
  await user.selectOptions(
    screen.getByLabelText('Generation provider'),
    'gemini',
  );
  expect(
    screen.getByRole('button', { name: 'Save server defaults' }),
  ).toBeDisabled();
  await user.type(
    screen.getByLabelText('Generation model'),
    'gemini-3.5-flash-lite',
  );
  await user.click(
    screen.getByRole('button', { name: 'Save server defaults' }),
  );
  await screen.findByText('Server defaults saved.');
  expect(patches[0].llm_provider).toBe('gemini');
  expect(patches[0].llm_model).toBe('gemini-3.5-flash-lite');
});
it('rejects a model identifier with unsupported characters', async () => {
  const user = userEvent.setup();
  settings.configured_providers.ollama = true;
  mount();
  await screen.findByLabelText('Generation provider');
  await user.selectOptions(
    screen.getByLabelText('Generation provider'),
    'ollama',
  );
  await user.type(screen.getByLabelText('Generation model'), 'model; command');
  expect(
    screen.getByRole('button', { name: 'Save server defaults' }),
  ).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Enter a valid model identifier',
  );
  expect(patches).toHaveLength(0);
});
it('shows safe backend save errors without claiming that settings were saved', async () => {
  const user = userEvent.setup();
  failSave = true;
  mount();
  await screen.findByLabelText('Generation provider');
  await user.click(
    screen.getByRole('button', { name: 'Save server defaults' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Provider is not configured on the server',
  );
  expect(screen.queryByText('Server defaults saved.')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save server defaults' }),
    ).toBeEnabled(),
  );
});
it('shows loading failures with retry and no editable invented defaults', async () => {
  failLoad = true;
  mount();
  expect(await screen.findByText('Settings unavailable')).toBeVisible();
  expect(
    screen.queryByLabelText('Generation provider'),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
});
it('does not offer a provider excluded by the server allowlist', async () => {
  settings.allowed_providers = ['none'];
  mount();
  await screen.findByLabelText('Generation provider');
  expect(
    screen.queryByRole('option', { name: /gemini/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('option', { name: /openai/ }),
  ).not.toBeInTheDocument();
});
