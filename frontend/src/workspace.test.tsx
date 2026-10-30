import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
const doc = {
  id: 'doc-1',
  title: 'Remote work guide',
  filename: 'remote.md',
  category: 'People',
  tags: ['remote'],
  status: 'indexed',
  chunk_count: 2,
  size_bytes: 2048,
  created_at: '2026-10-30T10:00:00Z',
  text: 'Employees can work remotely with manager approval.',
};
const config = {
  llm_provider: 'none',
  llm_model: '',
  embedding_model: 'all-MiniLM-L6-v2',
  embedding_dimension: 384,
  collection: 'knowledgeos',
  max_upload_mb: 10,
  chunk_size: 900,
  chunk_overlap: 150,
  default_top_k: 5,
  default_score_threshold: 0.3,
};
const source = {
  document_id: doc.id,
  title: doc.title,
  chunk_id: 'chunk-1',
  text: doc.text,
  score: 0.82,
  page: null,
  start_offset: 0,
  end_offset: doc.text.length,
};
function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      let data: unknown = { status: 'ok' };
      if (url.endsWith('/config')) data = config;
      else if (url.endsWith('/documents/doc-1')) data = doc;
      else if (url.endsWith('/documents')) data = [doc];
      else if (url.endsWith('/conversations') && init?.method === 'POST')
        data = {
          id: 'conv-1',
          title: 'Remote policy',
          created_at: doc.created_at,
          messages: [],
        };
      else if (url.endsWith('/conversations')) data = [];
      else if (url.includes('/conversations/conv-1/messages'))
        data = {
          id: 'msg-1',
          role: 'assistant',
          content: 'Retrieved remote work policy.',
          mode: 'retrieval_only',
          sources: [source],
          trace: null,
          created_at: doc.created_at,
        };
      else if (url.endsWith('/conversations/conv-1'))
        data = {
          id: 'conv-1',
          title: 'Remote policy',
          messages: [
            {
              id: 'msg-1',
              role: 'assistant',
              content: 'Retrieved remote work policy.',
              mode: 'retrieval_only',
              sources: [source],
              trace: null,
              created_at: doc.created_at,
            },
          ],
        };
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('workspace interactions', () => {
  it('filters documents and opens the actual extracted text', async () => {
    const user = userEvent.setup();
    mount('/documents');
    await screen.findByRole('button', { name: /Remote work guide MD/i });
    await user.type(
      screen.getByRole('textbox', { name: 'Search documents' }),
      'missing',
    );
    expect(screen.getByText('No matching documents')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(
      screen.getByRole('button', { name: /Remote work guide MD/i }),
    );
    expect(await screen.findByText(doc.text)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('rejects invalid retrieval preferences and saves valid preferences', async () => {
    const user = userEvent.setup();
    mount('/settings');
    const field = await screen.findByRole('spinbutton', {
      name: 'Default maximum source passages',
    });
    await user.clear(field);
    await user.type(field, '99');
    expect(
      screen.getByRole('button', { name: 'Save preferences' }),
    ).toBeDisabled();
    await user.clear(field);
    await user.type(field, '7');
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(localStorage.getItem('knowledgeos-top-k')).toBe('7');
    expect(
      screen.getByRole('button', { name: 'Preferences saved' }),
    ).toBeInTheDocument();
  });
  it('persists a question through the conversation API and labels retrieved output', async () => {
    const user = userEvent.setup();
    mount('/research');
    await user.type(
      await screen.findByRole('textbox', { name: 'Research question' }),
      'What is the remote policy?',
    );
    await user.click(screen.getByRole('button', { name: 'Send question' }));
    expect(
      await screen.findByText('Retrieved remote work policy.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Retrieved excerpts')).toBeInTheDocument();
    expect(screen.getByText(doc.text)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect passage' }));
    expect(
      within(screen.getByRole('dialog')).getByText(doc.text),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/conversations/conv-1/messages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('What is the remote policy?'),
        }),
      ),
    );
  });
  it('keeps a failed conversation creation visible and lets the question be retried', async () => {
    const user = userEvent.setup();
    const originalFetch = fetch;
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        if (
          String(input) === '/api/conversations' &&
          init?.method === 'POST' &&
          attempts++ === 0
        ) {
          return new Response(
            JSON.stringify({ detail: 'Conversation storage unavailable' }),
            { status: 503 },
          );
        }
        return originalFetch(input, init);
      }),
    );
    mount('/research');
    await user.type(
      await screen.findByRole('textbox', { name: 'Research question' }),
      'What is the remote policy?',
    );
    await user.click(screen.getByRole('button', { name: 'Send question' }));
    expect(
      await screen.findByText('Conversation storage unavailable'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry question' }));
    expect(
      await screen.findByText('Retrieved remote work policy.'),
    ).toBeInTheDocument();
  });
  it('clears the prior upload selection when an unsupported replacement is chosen', async () => {
    const user = userEvent.setup({ applyAccept: false });
    mount('/documents');
    await user.click(
      await screen.findByRole('button', { name: 'Upload document' }),
    );
    const input = screen.getByLabelText('Choose document file');
    await user.upload(
      input,
      new File(['Remote policy'], 'policy.md', { type: 'text/markdown' }),
    );
    expect(
      screen.getByRole('button', { name: 'Upload & index' }),
    ).toBeEnabled();
    await user.upload(input, new File(['unsupported'], 'policy.docx'));
    expect(
      await screen.findByText('Supported files: PDF, TXT, Markdown.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Upload & index' }),
    ).toBeDisabled();
  });
  it('asks from the floating assistant, preserves the chat and opens it in Research', async () => {
    const user = userEvent.setup();
    mount('/documents');
    await user.click(
      screen.getByRole('button', { name: 'Open knowledge assistant' }),
    );
    let panel = screen.getByRole('dialog', { name: 'Knowledge assistant' });
    await user.type(
      within(panel).getByLabelText('Quick chat question'),
      'What is the remote policy?',
    );
    await user.click(
      within(panel).getByRole('button', { name: 'Send quick chat question' }),
    );
    expect(
      await within(panel).findByText('Retrieved remote work policy.'),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Retrieval only')).toBeInTheDocument();
    expect(within(panel).getByText('Cited passages')).toBeInTheDocument();
    await user.click(within(panel).getByText('Source 1 · Remote work guide'));
    expect(panel.querySelector('details')).toHaveAttribute('open');
    expect(localStorage.getItem('knowledgeos-quick-chat-id')).toBe('conv-1');
    await user.click(
      within(panel).getByRole('button', { name: 'Minimize assistant' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Open knowledge assistant' }),
    );
    panel = screen.getByRole('dialog', { name: 'Knowledge assistant' });
    expect(
      await within(panel).findByText('Retrieved remote work policy.'),
    ).toBeInTheDocument();
    await user.click(
      within(panel).getByRole('button', { name: 'Open chat in Research' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByText('Retrieved remote work policy.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Research question'),
    ).toBeInTheDocument();
  });
  it('keeps a failed quick-chat question and retries without creating a second conversation', async () => {
    const user = userEvent.setup();
    const originalFetch = fetch;
    let attempts = 0;
    let creates = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input) === '/api/conversations' && init?.method === 'POST')
          creates++;
        if (String(input).endsWith('/conv-1/messages') && attempts++ === 0) {
          return new Response(
            JSON.stringify({ detail: 'Provider temporarily unavailable' }),
            { status: 503 },
          );
        }
        return originalFetch(input, init);
      }),
    );
    mount('/documents');
    await user.click(
      screen.getByRole('button', { name: 'Open knowledge assistant' }),
    );
    const panel = screen.getByRole('dialog', { name: 'Knowledge assistant' });
    await user.type(
      within(panel).getByLabelText('Quick chat question'),
      'Can I work remotely?',
    );
    await user.click(
      within(panel).getByRole('button', { name: 'Send quick chat question' }),
    );
    expect(
      await within(panel).findByText('Provider temporarily unavailable'),
    ).toBeInTheDocument();
    expect(within(panel).getByLabelText('Quick chat question')).toHaveValue(
      'Can I work remotely?',
    );
    await user.click(
      within(panel).getByRole('button', { name: 'Retry question' }),
    );
    await waitFor(() =>
      expect(within(panel).getByLabelText('Quick chat question')).toHaveValue(
        '',
      ),
    );
    expect(creates).toBe(1);
    expect(attempts).toBe(2);
  });
  it('shows API failures without inventing documents', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: 'Service unavailable' }), {
            status: 503,
          }),
      ),
    );
    mount('/documents');
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Remote work guide')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});
