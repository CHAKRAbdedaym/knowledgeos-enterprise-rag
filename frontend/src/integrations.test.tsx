import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Integrations, { type Integration } from './Integrations';

const timestamp = '2026-11-01T10:00:00Z';
const expires = '2099-01-01T00:00:00Z';
const secret = 'isolated-test-response-not-a-real-credential';
let integrations: Integration[];
let published: boolean;
let calls: {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
}[];
let failList: boolean;
function existing(): Integration {
  return {
    id: 'integration-1',
    name: 'Fictional employee portal',
    enabled: true,
    document_ids: [],
    allowed_origins: ['https://intranet.example.com'],
    rate_limit_per_minute: 60,
    created_at: timestamp,
    keys: [
      {
        id: 'key-1',
        prefix: 'test_prefix',
        expires_at: expires,
        revoked_at: null,
        last_used_at: null,
      },
    ],
  };
}
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <Integrations />
    </QueryClientProvider>,
  );
  return cache;
}
beforeEach(() => {
  integrations = [];
  published = false;
  calls = [];
  failList = false;
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = String(input),
        method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path, method, body });
      let result: unknown;
      if (path === '/api/documents')
        result = [
          {
            id: 'doc-1',
            title: 'Remote work policy',
            category: 'People',
            status: 'indexed',
            employee_available: published,
          },
        ];
      else if (path === '/api/documents/doc-1/access') {
        published = body.employee_available;
        result = { id: 'doc-1', employee_available: published };
      } else if (path.startsWith('/api/admin/analytics?'))
        result = {
          integrations_active: integrations.filter((i) => i.enabled).length,
          query_count: 0,
          no_result_count: 0,
          abstention_count: 0,
          provider_error_count: 0,
          average_latency_ms: 0,
          queries_by_integration: [],
          recent_events: [],
          query_trend: [],
        };
      else if (path === '/api/admin/integrations' && method === 'GET') {
        if (failList)
          return new Response(
            JSON.stringify({ detail: 'Integration service unavailable' }),
            { status: 503 },
          );
        result = integrations;
      } else if (path === '/api/admin/integrations' && method === 'POST') {
        const row = { ...existing(), ...body, keys: [] };
        integrations = [row];
        result = row;
      } else if (
        path === '/api/admin/integrations/integration-1' &&
        method === 'PATCH'
      ) {
        integrations[0] = { ...integrations[0], ...body };
        result = integrations[0];
      } else if (path.endsWith('/keys/key-1') && method === 'DELETE') {
        integrations[0].keys[0].revoked_at = timestamp;
        result = { revoked: true };
      } else if (path.endsWith('/keys') && method === 'POST') {
        result = {
          id: 'key-2',
          secret,
          prefix: 'new_test_prefix',
          expires_at: expires,
        };
        integrations[0].keys.push({
          id: 'key-2',
          prefix: 'new_test_prefix',
          expires_at: expires,
          revoked_at: null,
          last_used_at: null,
        });
      } else if (path.endsWith('/keys/key-1/rotate') && method === 'POST') {
        integrations[0].keys[0].revoked_at = timestamp;
        integrations[0].keys.push({
          id: 'key-2',
          prefix: 'new_test_prefix',
          expires_at: expires,
          revoked_at: null,
          last_used_at: null,
        });
        result = {
          id: 'key-2',
          secret,
          prefix: 'new_test_prefix',
          expires_at: expires,
        };
      } else throw new Error(`Unexpected request: ${method} ${path}`);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('creates a default-deny integration without publishing or selecting documents automatically', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByText('Your first connection starts here');
  await user.click(
    screen.getAllByRole('button', { name: 'Create integration' })[0],
  );
  const dialog = screen.getByRole('dialog', { name: 'Create integration' });
  expect(within(dialog).getByRole('checkbox')).not.toBeChecked();
  await user.type(
    within(dialog).getByLabelText('Integration name'),
    'HR intranet',
  );
  await user.click(
    within(dialog).getByRole('button', { name: 'Create integration' }),
  );
  await screen.findByRole('heading', { name: 'HR intranet' });
  expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
    name: 'HR intranet',
    allowed_origins: [],
    document_ids: [],
    rate_limit_per_minute: 60,
  });
  expect(calls.some((call) => call.path.endsWith('/access'))).toBe(false);
  expect(screen.getByText('No documents · access denied')).toBeVisible();
});
it('saves explicit scopes while keeping administrator-only documents unpublished', async () => {
  const user = userEvent.setup();
  integrations = [existing()];
  mount();
  await screen.findByRole('heading', { name: 'Fictional employee portal' });
  await user.click(screen.getByRole('button', { name: 'Manage access' }));
  const dialog = screen.getByRole('dialog');
  await user.click(
    within(dialog).getByRole('checkbox', { name: /Remote work policy/ }),
  );
  await user.click(
    within(dialog).getByRole('button', { name: 'Save access settings' }),
  );
  await waitFor(() =>
    expect(calls.some((call) => call.method === 'PATCH')).toBe(true),
  );
  expect(
    calls.find((call) => call.method === 'PATCH')?.body?.document_ids,
  ).toEqual(['doc-1']);
  expect(published).toBe(false);
  expect(calls.some((call) => call.path.endsWith('/access'))).toBe(false);
});
it('shows an issued secret once without persisting it in storage or query caches', async () => {
  const user = userEvent.setup();
  integrations = [existing()];
  const cache = mount();
  await screen.findByRole('heading', { name: 'Fictional employee portal' });
  await user.click(screen.getByRole('button', { name: 'Issue credential' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Issue credential',
    }),
  );
  expect(
    await screen.findByLabelText('One-time integration secret'),
  ).toHaveTextContent(secret);
  expect(
    JSON.stringify(
      cache
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    ),
  ).not.toContain(secret);
  expect(cache.getMutationCache().getAll()).toHaveLength(0);
  expect(JSON.stringify(localStorage)).not.toContain(secret);
  await user.click(screen.getByRole('button', { name: 'I have saved it' }));
  expect(screen.queryByText(secret)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByText('new_test_prefix…')).toBeInTheDocument(),
  );
});
it('requires explicit confirmation before revoking a credential', async () => {
  const user = userEvent.setup();
  integrations = [existing()];
  mount();
  await screen.findByRole('heading', { name: 'Fictional employee portal' });
  await user.click(screen.getByRole('button', { name: 'Revoke' }));
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Confirm revocation' }));
  await screen.findByText('Revoked');
  expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
});
it('rotates an existing credential using the atomic rotation endpoint', async () => {
  const user = userEvent.setup();
  integrations = [existing()];
  mount();
  await screen.findByRole('heading', { name: 'Fictional employee portal' });
  await user.click(
    screen.getByRole('button', { name: 'Rotate credential test_prefix' }),
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Rotate credential',
    }),
  );
  await screen.findByLabelText('One-time integration secret');
  expect(calls.find((call) => call.path.endsWith('/rotate'))?.body).toEqual({
    expires_in_days: 30,
  });
  expect(integrations[0].keys[0].revoked_at).toBeTruthy();
});
it('publishes a document only after a separate explicit confirmation', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByText('Your first connection starts here');
  await user.click(screen.getByText('Employee document availability'));
  await user.click(screen.getByRole('button', { name: 'Publish' }));
  expect(published).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Publish document' }));
  await waitFor(() => expect(published).toBe(true));
  expect(calls.find((call) => call.path.endsWith('/access'))?.body).toEqual({
    employee_available: true,
  });
});
it('rejects a portal origin containing a path before sending a request', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByText('Your first connection starts here');
  await user.click(
    screen.getAllByRole('button', { name: 'Create integration' })[0],
  );
  const dialog = screen.getByRole('dialog');
  await user.type(
    within(dialog).getByLabelText('Integration name'),
    'Invalid portal',
  );
  await user.type(
    within(dialog).getByLabelText('Allowed portal origins'),
    'https://intranet.example.com/path',
  );
  await user.click(
    within(dialog).getByRole('button', { name: 'Create integration' }),
  );
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Enter exact HTTP(S) origins',
  );
  expect(calls.some((call) => call.method === 'POST')).toBe(false);
});
it('shows backend failures and an honest empty activity state', async () => {
  failList = true;
  mount();
  expect(
    await screen.findByText('Integration service unavailable'),
  ).toBeVisible();
  expect(await screen.findByText('No integration traffic yet')).toBeVisible();
  expect(
    screen.queryByText('Fictional employee portal'),
  ).not.toBeInTheDocument();
});
