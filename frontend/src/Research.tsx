import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  FileText,
  FlaskConical,
  Info,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react';
import {
  api,
  date,
  messageError,
  type Config,
  type Conversation,
  type Message,
  type Source,
} from './api';
import { Badge, Button, ErrorState, Modal, Spinner } from './components/ui';
const suggestions = [
  ['People & culture', 'What is the remote work policy?'],
  [
    'Product & strategy',
    'What checks are required before a production release?',
  ],
  ['Engineering', 'How do we respond to a security incident?'],
  ['Getting started', 'What should a new employee know?'],
];
export default function Research() {
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [id, setId] = useState<string | null>(
    () =>
      (location.state as { conversationId?: string } | null)?.conversationId ??
      null,
  );
  const [draft, setDraft] = useState(
    ((location.state as { question?: string } | null)?.question || '').slice(
      0,
      2000,
    ),
  );
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [conversationRail, setConversationRail] = useState(
    () => !window.matchMedia('(max-width: 520px)').matches,
  );
  const [source, setSource] = useState<Source | null>(null);
  const [sourceMessage, setSourceMessage] = useState<Message | null>(null);
  const [trace, setTrace] = useState<Message | null>(null);
  const [rename, setRename] = useState<Conversation | null>(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [copied, setCopied] = useState('');
  const [tuning, setTuning] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [topK, setTopK] = useState(() =>
    Number(localStorage.getItem('knowledgeos-top-k') || 5),
  );
  const [threshold, setThreshold] = useState(() =>
    Number(localStorage.getItem('knowledgeos-threshold') || 0.3),
  );
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<Conversation[]>('/conversations'),
  });
  const conversation = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api<Conversation>(`/conversations/${id}`),
    enabled: !!id,
  });
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<Config>('/config'),
  });
  useEffect(() => {
    const state = location.state as {
      question?: string;
      conversationId?: string;
    } | null;
    if (state?.conversationId) setId(state.conversationId);
    if (state?.question) setDraft(state.question.slice(0, 2000));
    if (state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);
  const send = useMutation({
    mutationFn: async (question: string) => {
      let activeId = id;
      if (!activeId) {
        const created = await api<Conversation>('/conversations', {
          method: 'POST',
          body: JSON.stringify({ title: question.slice(0, 80) }),
        });
        activeId = created.id;
        setId(activeId);
      }
      const answer = await api<Message>(`/conversations/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          question,
          top_k: topK,
          score_threshold: threshold,
        }),
      });
      return { answer, activeId };
    },
    onSuccess: ({ activeId }) => {
      setPendingQuestion('');
      client.invalidateQueries({ queryKey: ['conversation', activeId] });
      client.invalidateQueries({ queryKey: ['conversations'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      client.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: () => {
      client.invalidateQueries({ queryKey: ['conversation', id] });
      client.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const renameMutation = useMutation({
    mutationFn: () =>
      api<Conversation>(`/conversations/${rename?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: title.trim() }),
      }),
    onSuccess: () => {
      setRename(null);
      client.invalidateQueries({ queryKey: ['conversations'] });
      client.invalidateQueries({ queryKey: ['conversation', id] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () =>
      api<void>(`/conversations/${deleting?.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (id === deleting?.id) {
        setId(null);
        setDraft('');
      }
      setDeleting(null);
      client.invalidateQueries({ queryKey: ['conversations'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'end',
    });
  }, [conversation.data?.messages?.length, send.isPending]);
  function submit(question = draft) {
    if (!question.trim() || question.length > 2000 || send.isPending) return;
    setPendingQuestion(question.trim());
    setDraft('');
    send.mutate(question.trim());
  }
  function newResearch() {
    if (send.isPending) return;
    setId(null);
    setDraft('');
    setPendingQuestion('');
    send.reset();
    textarea.current?.focus();
  }
  async function copy(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('unavailable');
    }
  }
  const messages = conversation.data?.messages || [];
  return (
    <div className={`research-layout ${conversationRail ? '' : 'rail-hidden'}`}>
      <aside className="conversation-rail">
        <div className="conversation-rail-head">
          <span>YOUR RESEARCH</span>
          <button
            className="icon-button"
            aria-label="Hide conversations"
            onClick={() => setConversationRail(false)}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <Button
          variant="secondary"
          onClick={newResearch}
          disabled={send.isPending}
        >
          <Plus size={16} />
          New conversation
        </Button>
        <div className="conversation-list">
          {conversations.isPending ? (
            <Spinner label="Loading conversations" />
          ) : conversations.isError ? (
            <ErrorState
              error={conversations.error}
              retry={() => conversations.refetch()}
            />
          ) : conversations.data?.length ? (
            conversations.data.map((c) => (
              <div
                className={`conversation-item ${id === c.id ? 'active' : ''}`}
                key={c.id}
              >
                <button
                  disabled={send.isPending}
                  onClick={() => {
                    setId(c.id);
                    setPendingQuestion('');
                    send.reset();
                  }}
                >
                  <MessageSquare size={15} />
                  <span>
                    {c.title}
                    <small>{date(c.created_at)}</small>
                  </span>
                </button>
                <div className="conversation-controls">
                  <button
                    className="icon-button"
                    aria-label={`Rename ${c.title}`}
                    onClick={() => {
                      setRename(c);
                      setTitle(c.title);
                    }}
                  >
                    <Settings2 size={13} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${c.title}`}
                    onClick={() => setDeleting(c)}
                    disabled={send.isPending}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rail-empty">
              <MessageSquare size={22} />
              <p>
                A little curiosity.
                <br />A new conversation.
              </p>
            </div>
          )}
        </div>
        <div className="rail-note">
          <Info size={15} />
          <span>Conversations are saved in this local workspace.</span>
        </div>
      </aside>
      <section className="research-main">
        <div className="research-topbar">
          <div>
            {!conversationRail && (
              <button
                className="icon-button"
                aria-label="Show conversations"
                onClick={() => setConversationRail(true)}
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <span className="research-title">
              {conversation.data?.title || 'A new perspective starts here'}
            </span>
          </div>
          <button className="research-mode" onClick={() => setTuning(true)}>
            <span className="status-dot" />
            {config.data?.llm_provider && config.data.llm_provider !== 'none'
              ? 'Provider configured'
              : 'Retrieval only'}
            <ChevronDown size={13} />
          </button>
        </div>
        <div className="chat-scroll">
          {!id && !pendingQuestion ? (
            <div className="research-welcome">
              <div className="welcome-symbol">
                <img src="/iaweb-icon.svg" width="46" height="46" alt="" />
                <span />
                <span />
              </div>
              <div className="eyebrow">THINK WITH YOUR KNOWLEDGE</div>
              <h1>
                What would you like
                <br />
                to understand?
              </h1>
              <p>
                Ask a question. Follow the evidence.
                <br />
                Make your next decision with a little more clarity.
              </p>
              <div className="suggestion-grid">
                {suggestions.map(([category, question]) => (
                  <button key={question} onClick={() => submit(question)}>
                    <span>{category}</span>
                    <strong>{question}</strong>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
              <div className="welcome-note">
                <BookOpen size={14} />
                Suggestions fit the synthetic starter corpus. Your results
                depend on indexed documents.
              </div>
            </div>
          ) : (
            <div className="messages">
              {conversation.isPending && !send.isPending && (
                <Spinner label="Loading conversation" />
              )}
              {conversation.isError && (
                <ErrorState
                  error={conversation.error}
                  retry={() => conversation.refetch()}
                />
              )}
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message message-${message.role}`}
                  >
                    <div className="message-avatar">
                      {message.role === 'user' ? (
                        'DE'
                      ) : (
                        <img
                          src="/iaweb-icon.svg"
                          width="28"
                          height="28"
                          alt=""
                        />
                      )}
                    </div>
                    <div className="message-body">
                      <div className="message-byline">
                        {message.role === 'user' ? 'You' : 'KnowledgeOS'}
                        {message.role === 'assistant' && (
                          <Badge
                            tone={
                              message.mode === 'abstained' ? 'amber' : 'purple'
                            }
                          >
                            {message.mode === 'retrieval_only'
                              ? 'Retrieved excerpts'
                              : message.mode === 'abstained'
                                ? 'Insufficient evidence'
                                : message.mode === 'grounded'
                                  ? 'Grounded answer'
                                  : 'Saved response'}
                          </Badge>
                        )}
                      </div>
                      <div className="markdown">
                        <ReactMarkdown skipHtml>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {message.role === 'assistant' && (
                        <>
                          {message.mode === 'retrieval_only' &&
                            message.sources?.[0] && (
                              <div className="retrieved-excerpt">
                                <div>
                                  <span>
                                    Source 1 · {message.sources[0].title}
                                  </span>
                                  <button
                                    className="text-link"
                                    onClick={() => {
                                      setSource(message.sources[0]);
                                      setSourceMessage(message);
                                    }}
                                  >
                                    Inspect passage
                                    <ArrowUpRight size={12} />
                                  </button>
                                </div>
                                <blockquote>
                                  {message.sources[0].text.slice(0, 450)}
                                  {message.sources[0].text.length > 450
                                    ? '…'
                                    : ''}
                                </blockquote>
                                <small>
                                  Quoted directly from the retrieved document.
                                </small>
                              </div>
                            )}
                          {message.sources?.length > 0 && (
                            <div className="message-sources">
                              <div className="sources-caption">
                                <BookOpen size={13} />
                                SOURCES · {message.sources.length} MATCHING
                                PASSAGES
                              </div>
                              <div className="source-chips">
                                {message.sources.map((s, index) => (
                                  <button
                                    key={`${s.chunk_id}-${index}`}
                                    onClick={() => {
                                      setSource(s);
                                      setSourceMessage(message);
                                    }}
                                  >
                                    <span>{index + 1}</span>
                                    <FileText size={13} />
                                    <strong>{s.title}</strong>
                                    <ArrowUpRight size={12} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="message-actions">
                            <button
                              onClick={() => copy(message)}
                              aria-label="Copy answer"
                            >
                              {copied === message.id ? (
                                <Check size={13} />
                              ) : (
                                <Copy size={13} />
                              )}{' '}
                              {copied === message.id ? 'Copied' : 'Copy'}
                            </button>
                            {message.trace && (
                              <button onClick={() => setTrace(message)}>
                                <FlaskConical size={13} />
                                Retrieval trace
                              </button>
                            )}
                            <span>
                              {message.trace
                                ? `${Math.round(message.trace.latency_ms)} ms`
                                : ''}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
              {send.isPending && (
                <>
                  {!messages.some(
                    (m) => m.role === 'user' && m.content === pendingQuestion,
                  ) && (
                    <div className="message message-user">
                      <div className="message-avatar">DE</div>
                      <div className="message-body">
                        <div className="message-byline">You</div>
                        <p>{pendingQuestion}</p>
                      </div>
                    </div>
                  )}
                  <div className="message message-assistant">
                    <div className="message-avatar">
                      <img
                        src="/iaweb-icon.svg"
                        width="28"
                        height="28"
                        alt=""
                      />
                    </div>
                    <div className="message-body">
                      <div className="message-byline">KnowledgeOS</div>
                      <Spinner label="Searching your knowledge and preparing a response…" />
                      <p className="form-hint">
                        Waiting for a complete response from the server.
                      </p>
                    </div>
                  </div>
                </>
              )}
              {send.isError && (
                <div className="chat-error" role="alert">
                  <p>{messageError(send.error)}</p>
                  <Button
                    variant="secondary"
                    onClick={() => send.mutate(pendingQuestion)}
                  >
                    <RefreshCw size={14} />
                    Retry question
                  </Button>
                </div>
              )}
              <div ref={bottom} />
            </div>
          )}
        </div>
        <div className="composer-wrap">
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              ref={textarea}
              aria-label="Research question"
              placeholder="Ask a question about your knowledge…"
              rows={2}
              maxLength={2000}
              value={draft}
              disabled={send.isPending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="composer-bottom">
              <span>
                <BookOpen size={13} />
                Grounded in your documents
              </span>
              <button
                className="send-button"
                aria-label="Send question"
                disabled={!draft.trim() || send.isPending}
              >
                {send.isPending ? (
                  <Spinner label="" />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            </div>
          </form>
          <div className="composer-disclaimer">
            {config.data?.llm_provider === 'none'
              ? 'No LLM provider configured. Responses show retrieved excerpts, without AI synthesis.'
              : 'Answers may be incomplete. Verify claims against the original sources.'}
            <button onClick={() => setTuning(true)}>
              <Settings2 size={12} />
              Search settings
            </button>
          </div>
        </div>
      </section>
      <Modal
        open={!!source}
        onOpenChange={(open) => {
          if (!open) setSource(null);
        }}
        title="Follow the evidence"
        description="Inspect the exact passage returned by the retrieval pipeline."
        wide
      >
        {source && (
          <div className="modal-body">
            <div className="source-detail-heading">
              <span className="file-icon">
                <FileText size={22} />
              </span>
              <div>
                <h3>{source.title}</h3>
                <p>
                  {source.page ? `Page ${source.page} · ` : ''}Chunk{' '}
                  {source.chunk_id.slice(0, 12)}
                </p>
              </div>
              <Badge tone="purple">
                {(source.score * 100).toFixed(1)}% relevance
              </Badge>
            </div>
            <blockquote className="source-passage">{source.text}</blockquote>
            <div className="source-offset">
              Character range {source.start_offset}–{source.end_offset}
              <span>Similarity score: {source.score.toFixed(4)}</span>
            </div>
            <p className="form-hint">
              Relevance is a similarity score, not a probability that an answer
              is correct.
            </p>
            <div className="source-navigation">
              {sourceMessage?.sources.map((s, index) => (
                <button
                  className={s.chunk_id === source.chunk_id ? 'active' : ''}
                  key={`${s.chunk_id}-${index}`}
                  onClick={() => setSource(s)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                navigate('/documents', {
                  state: { documentId: source.document_id },
                })
              }
            >
              Open original document
              <ArrowUpRight size={14} />
            </Button>
          </div>
        )}
      </Modal>
      <Modal
        open={!!trace}
        onOpenChange={(open) => {
          if (!open) setTrace(null);
        }}
        title="The retrieval, explained"
        description="Actual timings and configuration recorded for this response."
      >
        {trace?.trace && (
          <div className="modal-body">
            <dl className="detail-list">
              <dt>Question</dt>
              <dd>
                {trace.trace.question ||
                  messages[messages.findIndex((m) => m.id === trace.id) - 1]
                    ?.content ||
                  'Not recorded'}
              </dd>
              <dt>Total latency</dt>
              <dd>{trace.trace.latency_ms.toFixed(0)} ms</dd>
              <dt>Retrieval latency</dt>
              <dd>{trace.trace.retrieval_ms.toFixed(0)} ms</dd>
              <dt>Matched chunks</dt>
              <dd>{trace.trace.matched_chunks}</dd>
              <dt>Requested results</dt>
              <dd>{trace.trace.top_k}</dd>
              <dt>Score threshold</dt>
              <dd>{trace.trace.score_threshold}</dd>
              <dt>Provider</dt>
              <dd>{trace.trace.provider || 'none'}</dd>
              <dt>Language model</dt>
              <dd>{trace.trace.model || 'Not used'}</dd>
              <dt>Embedding model</dt>
              <dd>{trace.trace.embedding_model}</dd>
            </dl>
            <div className="trace-sources">
              {trace.sources.map((s, i) => (
                <div key={`${s.chunk_id}-${i}`}>
                  <strong>{s.title}</strong>
                  <span>
                    Chunk {s.chunk_id.slice(0, 16)} · score {s.score.toFixed(4)}
                  </span>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
            <p className="inline-info">
              Mode: {trace.mode}. Retrieval-only mode returns excerpts directly.
              Grounded mode asks the configured provider to answer using
              retrieved context.
            </p>
          </div>
        )}
      </Modal>
      <Modal
        open={!!rename}
        onOpenChange={(open) => !open && setRename(null)}
        title="Rename conversation"
        description="Give your research a useful, memorable title."
      >
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            renameMutation.mutate();
          }}
        >
          <label>
            Conversation title
            <input
              autoFocus
              aria-label="Conversation title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {renameMutation.isError && (
            <p role="alert" className="form-error">
              {messageError(renameMutation.error)}
            </p>
          )}
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setRename(null)}
            >
              Cancel
            </Button>
            <Button disabled={!title.trim() || renameMutation.isPending}>
              Save title
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete conversation?"
        description="This permanently removes the conversation and its saved messages."
      >
        <div className="modal-body">
          <p>Delete “{deleting?.title}”?</p>
          {deleteMutation.isError && (
            <p role="alert" className="form-error">
              {messageError(deleteMutation.error)}
            </p>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep conversation
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Delete conversation
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={tuning}
        onOpenChange={setTuning}
        title="Research settings"
        description="These preferences apply to your next question, and are saved in this browser."
      >
        <div className="modal-body">
          <label>
            Maximum source passages <strong>{topK}</strong>
            <input
              aria-label="Maximum source passages"
              type="range"
              min={1}
              max={10}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
            />
          </label>
          <p className="form-hint">
            More passages provide broader context, with more text to inspect.
          </p>
          <label>
            Minimum relevance <strong>{threshold.toFixed(2)}</strong>
            <input
              aria-label="Minimum relevance"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <p className="form-hint">
            Higher thresholds may return fewer matching sources.
          </p>
          <Button
            onClick={() => {
              localStorage.setItem('knowledgeos-top-k', String(topK));
              localStorage.setItem('knowledgeos-threshold', String(threshold));
              setTuning(false);
            }}
          >
            Save preferences
            <Check size={14} />
          </Button>
        </div>
      </Modal>
    </div>
  );
}
