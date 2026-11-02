import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthGate } from './Auth';
import { useAdminAuth } from './auth-context';
import { api, setCsrfToken } from './api';
function Protected() {
  const { logout } = useAdminAuth();
  return (
    <>
      <h1>Private dashboard</h1>
      <button onClick={() => void logout()}>Sign out</button>
    </>
  );
}
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/documents']}>
        <AuthGate>
          <Protected />
        </AuthGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setCsrfToken('');
});
it('gates private UI, handles invalid login, signs in and signs out with memory CSRF', async () => {
  const user = userEvent.setup();
  let authenticated = false;
  const fetch = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith('/auth/me'))
        return new Response(
          JSON.stringify({ detail: 'Authentication required' }),
          { status: 401 },
        );
      if (path.endsWith('/auth/login')) {
        if (JSON.parse(String(init?.body)).password === 'incorrect')
          return new Response(
            JSON.stringify({ detail: 'Invalid username or password' }),
            { status: 401 },
          );
        authenticated = true;
        return new Response(
          JSON.stringify({
            id: 'fixture',
            username: 'fixture',
            csrf_token: 'test-csrf',
          }),
        );
      }
      if (path.endsWith('/auth/logout')) {
        expect((init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
          'test-csrf',
        );
        authenticated = false;
        return new Response('{}');
      }
      throw new Error('Unexpected protected request before login');
    },
  );
  vi.stubGlobal('fetch', fetch);
  mount();
  await screen.findByRole('heading', { name: 'Welcome back.' });
  expect(screen.queryByText('Private dashboard')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Username'), 'fixture');
  await user.type(screen.getByLabelText('Password'), 'incorrect');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid username or password',
  );
  await user.type(screen.getByLabelText('Password'), 'valid-fixture-input');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('Private dashboard');
  expect(authenticated).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Welcome back.' });
  expect(authenticated).toBe(false);
});
it('clears the private UI when an API reports an expired session', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/auth/me')
        ? new Response(
            JSON.stringify({
              id: 'fixture',
              username: 'fixture',
              csrf_token: 'csrf',
            }),
          )
        : new Response(JSON.stringify({ detail: 'Session expired' }), {
            status: 401,
          }),
    ),
  );
  mount();
  await screen.findByText('Private dashboard');
  await expect(api('/documents')).rejects.toThrow('Session expired');
  await waitFor(() =>
    expect(screen.queryByText('Private dashboard')).not.toBeInTheDocument(),
  );
  await screen.findByRole('heading', { name: 'Welcome back.' });
});
