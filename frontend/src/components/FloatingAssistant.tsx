import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowUpRight, BookOpen, Plus, Send, X } from 'lucide-react';
import {
  api,
  messageError,
  type Config,
  type Conversation,
  type Message,
} from '../api';
import { Badge, Button, ErrorState, Spinner } from './ui';

const storageKey = 'knowledgeos-quick-chat-id';

function preference(
  key: string,
  fallback: number,
  min: number,
  max: number,
  integer = false,
) {
  const raw = localStorage.getItem(key);
  const value = raw === null || raw.trim() === '' ? fallback : Number(raw);
  return Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
    ? value
    : fallback;
}

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState<string | null>(() =>
    localStorage.getItem(storageKey),
  );
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const navigate = useNavigate();
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<Config>('/config'),
  });
  const conversation = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api<Conversation>(`/conversations/${id}`),
    enabled: open && !!id,
    retry: false,
  });
  const send = useMutation({
    mutationFn: async (question: string) => {
      let activeId = id;
      if (!activeId) {
        const created = await api<Conversation>('/conversations', {
          method: 'POST',
          body: JSON.stringify({ title: question.slice(0, 80) }),
        });
        activeId = created.id;
        localStorage.setItem(storageKey, activeId);
        setId(activeId);
      }
      await api<Message>(`/conversations/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          question,
          top_k: preference(
            'knowledgeos-top-k',
            config.data?.default_top_k ?? 5,
            1,
            10,
            true,
          ),
          score_threshold: preference(
            'knowledgeos-threshold',
            config.data?.default_score_threshold ?? 0.3,
            0,
            1,
          ),
        }),
      });
      return activeId;
    },
    onSuccess: async (activeId) => {
      await client.invalidateQueries({ queryKey: ['conversation', activeId] });
      setDraft('');
      for (const key of ['conversations', 'dashboard', 'analytics']) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const messages = conversation.data?.messages ?? [];
  useEffect(() => {
    const element = scroll.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, send.isPending, open]);

  function submit(question = draft) {
    if (
      !question.trim() ||
      question.length > 2000 ||
      send.isPending ||
      conversation.isError
    )
      return;
    setDraft(question.trim());
    send.mutate(question.trim());
  }
  function newChat() {
    localStorage.removeItem(storageKey);
    setId(null);
    setDraft('');
    send.reset();
    input.current?.focus();
  }
  const mode = config.isPending
    ? 'Checking mode…'
    : config.isError
      ? 'Mode unavailable'
      : config.data.llm_provider === 'none'
        ? 'Retrieval only'
        : 'Provider configured';

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Trigger
        className="assistant-launcher"
        aria-label={
          open ? 'Close knowledge assistant' : 'Open knowledge assistant'
        }
      >
        {open ? (
          <X size={24} />
        ) : (
          <img src="/iaweb-icon.svg" width={38} height={38} alt="" />
        )}
        <span className="assistant-launcher-label">
          {open ? 'Minimize chat' : 'Ask KnowledgeOS'}
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          className="assistant-panel"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            input.current?.focus();
          }}
        >
          <header className="assistant-header">
            <span className="assistant-brand-mark">
              <img src="/iaweb-logo.svg" width={72} height={19} alt="IAWEB" />
            </span>
            <div>
              <span className="assistant-brand-name">KnowledgeOS</span>
              <Dialog.Title>Knowledge assistant</Dialog.Title>
              <Dialog.Description>
                Your knowledge, connected.
              </Dialog.Description>
            </div>
            <div className="assistant-header-actions">
              <button
                className="icon-button"
                aria-label="Start a new quick chat"
                title="New chat"
                disabled={send.isPending}
                onClick={newChat}
              >
                <Plus size={18} />
              </button>
              {id && (
                <button
                  className="icon-button"
                  aria-label="Open chat in Research"
                  title="Open in Research"
                  disabled={send.isPending || conversation.isError}
                  onClick={() => {
                    setOpen(false);
                    navigate('/research', { state: { conversationId: id } });
                  }}
                >
                  <ArrowUpRight size={18} />
                </button>
              )}
              <Dialog.Close
                className="icon-button"
                aria-label="Minimize assistant"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
          </header>
          <div className="assistant-mode">
            <Badge tone="purple">
              <span className="assistant-mode-dot" aria-hidden="true" />
              {mode}
            </Badge>
            <span>Synthetic demo workspace</span>
          </div>
          <div className="assistant-scroll" ref={scroll}>
            {!id && (
              <div className="assistant-welcome">
                <div className="assistant-welcome-art" aria-hidden="true">
                  <img src="/iaweb-icon.svg" width={44} height={44} alt="" />
                  <i />
                  <i />
                </div>
                <span className="assistant-eyebrow">
                  INFORMATION MEETS INTELLIGENCE
                </span>
                <h3>
                  Your knowledge.
                  <br />
                  <span>One conversation.</span>
                </h3>
                <p>Ask a question. Find the passage behind the answer.</p>
                <div className="assistant-suggestions-label">
                  WHERE SHALL WE START?
                </div>
                <button
                  onClick={() => submit('What is the remote work policy?')}
                  disabled={send.isPending}
                >
                  <span className="assistant-question-number">01</span>
                  <span>What is the remote work policy?</span>
                  <span className="assistant-question-arrow">
                    <ArrowUpRight size={15} />
                  </span>
                </button>
                <button
                  onClick={() =>
                    submit('How do we report a security incident?')
                  }
                  disabled={send.isPending}
                >
                  <span className="assistant-question-number">02</span>
                  <span>How do we report a security incident?</span>
                  <span className="assistant-question-arrow">
                    <ArrowUpRight size={15} />
                  </span>
                </button>
              </div>
            )}
            {id && conversation.isPending && (
              <Spinner label="Loading your chat…" />
            )}
            {conversation.isError && (
              <ErrorState
                error={conversation.error}
                retry={() => conversation.refetch()}
              />
            )}
            <div
              className="assistant-messages"
              role="log"
              aria-label="Quick chat messages"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`assistant-message assistant-message-${message.role}`}
                >
                  <div className="assistant-byline">
                    {message.role === 'user' ? 'You' : 'KnowledgeOS'}
                    {message.role === 'assistant' && (
                      <span>
                        {message.mode === 'retrieval_only'
                          ? 'Cited passages'
                          : message.mode === 'abstained'
                            ? 'Insufficient evidence'
                            : 'Grounded answer'}
                      </span>
                    )}
                  </div>
                  <div className="markdown">
                    <ReactMarkdown skipHtml>{message.content}</ReactMarkdown>
                  </div>
                  {message.mode === 'retrieval_only' && message.sources[0] && (
                    <blockquote className="assistant-excerpt">
                      {message.sources[0].text.slice(0, 450)}
                      {message.sources[0].text.length > 450 ? '…' : ''}
                    </blockquote>
                  )}
                  {message.sources.length > 0 && (
                    <div className="assistant-sources">
                      {message.sources.map((source, index) => (
                        <details key={`${source.chunk_id}-${index}`}>
                          <summary>
                            <BookOpen size={12} />
                            <span>
                              Source {index + 1} · {source.title}
                              {source.page ? ` · p. ${source.page}` : ''}
                            </span>
                          </summary>
                          <p>{source.text}</p>
                          <small>
                            Similarity {source.score.toFixed(3)} · not an
                            accuracy score
                          </small>
                        </details>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
            {send.isPending && (
              <div className="assistant-pending" role="status">
                <p>{send.variables}</p>
                <Spinner label="Searching your documents…" />
              </div>
            )}
            {send.isError && (
              <div className="assistant-error" role="alert">
                <p>{messageError(send.error)}</p>
                <Button
                  variant="secondary"
                  onClick={() => submit(send.variables)}
                >
                  Retry question
                </Button>
              </div>
            )}
          </div>
          <form
            className="assistant-composer"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="sr-only" htmlFor="quick-chat-question">
              Quick chat question
            </label>
            <div className="assistant-input">
              <textarea
                id="quick-chat-question"
                ref={input}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Ask about your documents…"
                disabled={send.isPending || conversation.isError}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <button
                type="submit"
                aria-label="Send quick chat question"
                disabled={
                  !draft.trim() || send.isPending || conversation.isError
                }
              >
                <Send size={17} />
              </button>
            </div>
            <p>
              {config.data?.llm_provider === 'none'
                ? 'Cited excerpts only · no AI generation'
                : 'Check the sources before relying on a response.'}
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
