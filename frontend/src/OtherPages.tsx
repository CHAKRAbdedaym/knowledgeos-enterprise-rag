import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Code2,
  Database,
  FileText,
  FlaskConical,
  Layers,
  Lock,
  MessageSquare,
  Network,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  api,
  messageError,
  type Analytics,
  type Config,
  type Health,
  type Source,
  type Trace,
} from './api';
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  SectionTitle,
  Spinner,
} from './components/ui';
const colors = ['var(--indigo)', '#6c91ff', '#43aac4', '#6eab9c', '#c8a46c'];
export function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const query = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => api<Analytics>(`/analytics?days=${days}`),
  });
  const data = query.data;
  return (
    <>
      <PageHeading
        eyebrow="A PULSE ON YOUR WORKSPACE"
        title="Intelligence"
        description="Understand what your team is asking, and which knowledge makes a difference."
        action={
          <div className="segmented">
            {[7, 30, 90].map((d) => (
              <button
                className={days === d ? 'active' : ''}
                key={d}
                onClick={() => setDays(d)}
              >
                {d} days
              </button>
            ))}
          </div>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : (
        data && (
          <>
            <div className="stats-grid analytics-stats">
              {[
                {
                  label: 'Questions asked',
                  value: data.queries.toLocaleString(),
                  note: `In the last ${days} days`,
                  icon: MessageSquare,
                },
                {
                  label: 'Average response time',
                  value: data.queries
                    ? `${Math.round(data.average_latency_ms)} ms`
                    : '—',
                  note: 'Measured server latency',
                  icon: Clock,
                },
                {
                  label: 'Sources per response',
                  value: data.queries ? data.average_chunks.toFixed(1) : '—',
                  note: 'Average retrieved passages',
                  icon: BookOpen,
                },
              ].map((s) => (
                <div className="stat-card" key={s.label}>
                  <div className="stat-label">
                    {s.label}
                    <span className="stat-icon purple">
                      <s.icon size={18} />
                    </span>
                  </div>
                  <strong>{s.value}</strong>
                  <span className="stat-note">{s.note}</span>
                </div>
              ))}
            </div>
            <section className="panel analytics-chart">
              <SectionTitle
                title="Questions over time"
                description="Real questions from your saved research conversations."
                action={<Badge>Last {days} days</Badge>}
              />
              {data.queries ? (
                <div className="large-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.query_trend}
                      margin={{ top: 15, right: 15, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="analyticsFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--indigo)"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--indigo)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border)"
                        strokeDasharray="3 4"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) =>
                          new Date(`${v}T12:00:00`).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric' },
                          )
                        }
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                        tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--panel)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                        }}
                      />
                      <Area
                        dataKey="count"
                        name="Questions"
                        type="monotone"
                        stroke="var(--indigo)"
                        fill="url(#analyticsFill)"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  title="Every question leaves a signal"
                  description="Ask a research question to begin tracking workspace activity."
                />
              )}
            </section>
            <div className="two-column">
              <section className="panel">
                <SectionTitle
                  title="Most referenced documents"
                  description="The sources that appear most often in answers."
                />
                {data.most_referenced.length ? (
                  <div className="ranked-documents">
                    {data.most_referenced.map((doc, index) => (
                      <div key={doc.id}>
                        <span className="rank">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="file-icon">
                          <FileText size={18} />
                        </span>
                        <strong>{doc.title}</strong>
                        <Badge>{doc.count} references</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Your sources will tell a story"
                    description="Document references appear after successful retrievals."
                  />
                )}
              </section>
              <section className="panel">
                <SectionTitle
                  title="Knowledge distribution"
                  description="Indexed documents by category."
                />
                {data.categories.length ? (
                  <div className="category-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.categories}
                        layout="vertical"
                        margin={{ left: 5, right: 25 }}
                      >
                        <XAxis type="number" allowDecimals={false} hide />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={110}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: 'var(--muted)' }}
                        />
                        <Tooltip
                          cursor={{ fill: 'var(--canvas)' }}
                          contentStyle={{
                            background: 'var(--panel)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                          }}
                        />
                        <Bar
                          dataKey="count"
                          name="Documents"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={22}
                        >
                          {data.categories.map((c, i) => (
                            <Cell
                              key={c.name}
                              fill={colors[i % colors.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty
                    title="Start building your knowledge"
                    description="Your document categories will appear here."
                  />
                )}
              </section>
            </div>
            <p className="metrics-note">
              <Activity size={14} />
              Metrics reflect persisted server records. No estimates or sample
              activity are added.
            </p>
          </>
        )
      )}
    </>
  );
}
export function Architecture() {
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<Config>('/config'),
  });
  const [question, setQuestion] = useState('');
  const diagnostics = useMutation({
    mutationFn: () =>
      api<{ question: string; sources: Source[]; trace: Trace }>('/retrieval', {
        method: 'POST',
        body: JSON.stringify({ question, top_k: 5, score_threshold: 0.3 }),
      }),
  });
  const c = config.data;
  const steps = [
    {
      icon: FileText,
      title: 'Ingest',
      label: '01',
      text: 'Files are validated, stored locally, and converted to plain text.',
      meta: 'PDF · TXT · Markdown',
    },
    {
      icon: Layers,
      title: 'Chunk',
      label: '02',
      text: 'Text is split into overlapping, traceable source passages.',
      meta: c
        ? `${c.chunk_size} characters · ${c.chunk_overlap} overlap`
        : 'Configured chunk size and overlap',
    },
    {
      icon: Network,
      title: 'Embed & index',
      label: '03',
      text: 'FastEmbed computes local ONNX embeddings, persisted in Qdrant for similarity search.',
      meta: c
        ? `${c.embedding_dimension} dimensions · local model`
        : 'FastEmbed · Qdrant',
    },
    {
      icon: Search,
      title: 'Retrieve',
      label: '04',
      text: 'The question is embedded and matched to the most relevant passages.',
      meta: 'Similarity threshold · top-k results',
    },
    {
      icon: Sparkles,
      title: 'Respond',
      label: '05',
      text: 'Return cited excerpts, or synthesize an answer with the configured provider.',
      meta:
        c?.llm_provider === 'none'
          ? 'Retrieval only · no LLM'
          : 'Optional grounded generation',
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="TRANSPARENT BY DESIGN"
        title="From documents to understanding."
        description="A closer look at the system behind every source-grounded answer."
        action={
          <Badge tone="green">
            <Code2 size={12} />
            Inspectable architecture
          </Badge>
        }
      />
      <section className="architecture-intro">
        <div>
          <Badge tone="purple">
            <Network size={12} />
            RETRIEVAL-AUGMENTED GENERATION
          </Badge>
          <h2>
            Good answers begin
            <br />
            with the right context.
          </h2>
          <p>
            KnowledgeOS connects a question to relevant passages in your
            documents. Evidence stays visible, and the system tells you exactly
            how it arrived there.
          </p>
        </div>
        <div className="architecture-principles">
          <span>
            <ShieldCheck size={18} />
            <strong>Source-grounded</strong>
            <small>Inspect every returned passage</small>
          </span>
          <span>
            <Lock size={18} />
            <strong>Local by default</strong>
            <small>Files, vectors, and metadata</small>
          </span>
          <span>
            <FlaskConical size={18} />
            <strong>Honest by design</strong>
            <small>Recorded timings and clear modes</small>
          </span>
        </div>
      </section>
      <section className="panel pipeline-panel">
        <SectionTitle
          title="The knowledge pipeline"
          description="Five steps. A traceable connection from file to answer."
        />
        <div className="pipeline">
          {steps.map((step, index) => (
            <div className="pipeline-step" key={step.label}>
              <div className="pipeline-step-icon">
                <step.icon size={24} />
                <span>{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="pipeline-arrow" size={18} />
              )}
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <small>{step.meta}</small>
            </div>
          ))}
        </div>
      </section>
      <div className="two-column architecture-details">
        <section className="panel">
          <SectionTitle
            title="A deliberately practical stack"
            description="Clear responsibilities, without hidden services."
          />
          <div className="stack-list">
            {[
              {
                icon: Code2,
                title: 'React + TypeScript',
                desc: 'Accessible, responsive research workspace',
              },
              {
                icon: Server,
                title: 'FastAPI',
                desc: 'Validated API, ingestion, and orchestration',
              },
              {
                icon: Database,
                title: 'PostgreSQL + local files',
                desc: 'Documents, conversations, and query records',
              },
              {
                icon: Network,
                title: 'FastEmbed + Qdrant',
                desc: 'ONNX embeddings and persisted vector search via LangChain',
              },
            ].map((s) => (
              <div key={s.title}>
                <s.icon size={20} />
                <span>
                  <strong>{s.title}</strong>
                  <small>{s.desc}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <SectionTitle
            title="When there isn’t enough evidence"
            description="Clear limits make a more useful research tool."
          />
          <div className="architecture-copy">
            <p>
              If no passages meet the relevance threshold, the system abstains.
              It doesn’t create a source or fill the gap with an invented
              answer.
            </p>
            <p>
              Without a language model provider, the result is a selection of
              retrieved excerpts. With a provider, the system requests an answer
              grounded in those excerpts.
            </p>
            <div className="inline-info">
              <InfoIcon />
              This is a synthetic portfolio reconstruction. It does not
              implement enterprise SSO, multi-tenant isolation, or production
              compliance controls.
            </div>
          </div>
        </section>
      </div>
      <section className="panel diagnostics-panel">
        <SectionTitle
          title="Try the retrieval layer"
          description="Inspect matching passages directly, without asking a language model."
          action={
            <Badge>
              <FlaskConical size={12} />
              Live diagnostic
            </Badge>
          }
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            diagnostics.mutate();
          }}
          className="diagnostics-form"
        >
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Diagnostic question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              maxLength={2000}
              placeholder="e.g. What is the remote work policy?"
            />
          </div>
          <Button disabled={!question.trim() || diagnostics.isPending}>
            {diagnostics.isPending ? (
              <Spinner label="Retrieving" />
            ) : (
              <>
                Run retrieval
                <ArrowRight size={15} />
              </>
            )}
          </Button>
        </form>
        {diagnostics.isError && <ErrorState error={diagnostics.error} />}{' '}
        {diagnostics.data && (
          <div className="diagnostics-results">
            <div>
              <Badge tone="purple">
                {diagnostics.data.sources.length} matching passages
              </Badge>
              <Badge>
                {Math.round(diagnostics.data.trace.retrieval_ms)} ms retrieval
              </Badge>
            </div>
            {diagnostics.data.sources.length ? (
              diagnostics.data.sources.map((s, i) => (
                <article key={`${s.chunk_id}-${i}`}>
                  <strong>
                    {s.title}
                    <span>{(s.score * 100).toFixed(1)}% relevance</span>
                  </strong>
                  <p>{s.text}</p>
                </article>
              ))
            ) : (
              <Empty
                title="No passages met the threshold"
                description="Try another question or add relevant documents to your knowledge base."
              />
            )}
          </div>
        )}
      </section>
    </>
  );
}
function InfoIcon() {
  return <ShieldCheck size={17} />;
}
export function SettingsPage() {
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<Config>('/config'),
  });
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<Health>('/health'),
  });
  const readiness = useQuery({
    queryKey: ['readiness'],
    queryFn: () => api<Health>('/readiness'),
    retry: false,
  });
  const [topK, setTopK] = useState(
    localStorage.getItem('knowledgeos-top-k') || '5',
  );
  const [threshold, setThreshold] = useState(
    localStorage.getItem('knowledgeos-threshold') || '0.3',
  );
  const [saved, setSaved] = useState(false);
  const valid =
    Number.isInteger(Number(topK)) &&
    Number(topK) >= 1 &&
    Number(topK) <= 10 &&
    Number(threshold) >= 0 &&
    Number(threshold) <= 1 &&
    threshold.trim() !== '';
  const c = config.data;
  return (
    <>
      <PageHeading
        eyebrow="A WORKSPACE THAT MAKES SENSE"
        title="Settings"
        description="Inspect your environment and make research feel a little more like you."
        action={
          <Badge>
            <Lock size={12} />
            Sanitized configuration
          </Badge>
        }
      />
      <section className="panel settings-panel">
        <SectionTitle
          title="System connection"
          description="Live checks from the running backend."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                health.refetch();
                readiness.refetch();
                config.refetch();
              }}
            >
              Refresh status
            </Button>
          }
        />
        <div className="connection-grid">
          <div>
            <span className={`status-dot ${health.isError ? 'offline' : ''}`} />
            <span>
              <strong>API health</strong>
              <small>
                {health.isPending
                  ? 'Checking…'
                  : health.isError
                    ? messageError(health.error)
                    : health.data?.status || 'Responding'}
              </small>
            </span>
            <Badge tone={health.isSuccess ? 'green' : 'amber'}>
              {health.isSuccess ? 'Connected' : 'Unavailable'}
            </Badge>
          </div>
          <div>
            <span
              className={`status-dot ${readiness.isError ? 'offline' : ''}`}
            />
            <span>
              <strong>Retrieval readiness</strong>
              <small>
                {readiness.isPending
                  ? 'Checking database and vector store…'
                  : readiness.isError
                    ? messageError(readiness.error)
                    : readiness.data?.status || 'Ready'}
              </small>
            </span>
            <Badge tone={readiness.isSuccess ? 'green' : 'amber'}>
              {readiness.isSuccess ? 'Ready' : 'Not ready'}
            </Badge>
          </div>
        </div>
        <p className="form-hint">
          Health confirms the API responds. Readiness checks the database schema
          and Qdrant connection. Embeddings load when first needed.
        </p>
      </section>
      {config.isPending ? (
        <Loading />
      ) : config.isError ? (
        <ErrorState error={config.error} retry={() => config.refetch()} />
      ) : (
        c && (
          <div className="two-column settings-columns">
            <section className="panel settings-panel">
              <SectionTitle
                title="Language model"
                description="Runtime configuration · read only"
                action={
                  <span className="soft-icon">
                    <Sparkles size={19} />
                  </span>
                }
              />
              <dl className="detail-list">
                <dt>Provider</dt>
                <dd>
                  <Badge tone={c.llm_provider === 'none' ? 'amber' : 'green'}>
                    {c.llm_provider === 'none'
                      ? 'None · retrieval only'
                      : c.llm_provider}
                  </Badge>
                </dd>
                <dt>Model</dt>
                <dd>{c.llm_model || 'Not configured'}</dd>
                <dt>Answer behavior</dt>
                <dd>
                  {c.llm_provider === 'none'
                    ? 'Cited source excerpts'
                    : 'Grounded synthesis'}
                </dd>
              </dl>
              <div className="inline-info">
                {c.llm_provider === 'none'
                  ? 'No provider is configured. Research returns relevant document excerpts without AI generation.'
                  : 'Relevant passages are sent to the configured language model to produce a source-grounded answer.'}{' '}
                Change provider settings through the server environment, then
                restart the backend.
              </div>
            </section>
            <section className="panel settings-panel">
              <SectionTitle
                title="Embedding & indexing"
                description="Local retrieval configuration · read only"
                action={
                  <span className="soft-icon">
                    <Layers size={19} />
                  </span>
                }
              />
              <dl className="detail-list">
                <dt>Embedding model</dt>
                <dd>{c.embedding_model}</dd>
                <dt>Dimensions</dt>
                <dd>{c.embedding_dimension}</dd>
                <dt>Collection</dt>
                <dd className="mono">{c.collection}</dd>
                <dt>Chunk size / overlap</dt>
                <dd>
                  {c.chunk_size} / {c.chunk_overlap} characters
                </dd>
                <dt>Maximum upload</dt>
                <dd>{c.max_upload_mb} MB</dd>
              </dl>
            </section>
          </div>
        )
      )}
      <section className="panel settings-panel">
        <SectionTitle
          title="Research preferences"
          description="Saved in this browser and applied to new questions."
          action={
            <span className="soft-icon">
              <Settings2 size={19} />
            </span>
          }
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) {
              localStorage.setItem('knowledgeos-top-k', topK);
              localStorage.setItem('knowledgeos-threshold', threshold);
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            }
          }}
        >
          <div className="form-row preferences-row">
            <label>
              Maximum source passages
              <input
                aria-label="Default maximum source passages"
                type="number"
                min={1}
                max={10}
                step={1}
                value={topK}
                onChange={(e) => setTopK(e.target.value)}
              />
              <small>Between 1 and 10 passages per question.</small>
            </label>
            <label>
              Minimum relevance score
              <input
                aria-label="Default minimum relevance score"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <small>Between 0 and 1. Higher values narrow results.</small>
            </label>
          </div>
          {!valid && (
            <p role="alert" className="form-error">
              Enter a whole number from 1–10 for passages and a relevance score
              from 0–1.
            </p>
          )}
          <div className="settings-save">
            <p>
              These preferences affect retrieval, not the server’s
              configuration.
            </p>
            <Button disabled={!valid}>
              {saved ? (
                <>
                  <Check size={15} />
                  Preferences saved
                </>
              ) : (
                'Save preferences'
              )}
            </Button>
          </div>
        </form>
      </section>
      <div className="inline-tip">
        <ShieldCheck size={22} />
        <p>
          <strong>Built for an inspectable demo.</strong> Configuration values
          are sanitized by the API. Secret keys are never displayed. This local
          workspace uses synthetic sample data.
        </p>
      </div>
    </>
  );
}
