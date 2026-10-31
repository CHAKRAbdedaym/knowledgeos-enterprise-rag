import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  CartesianGrid,
} from 'recharts';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Database,
  FileText,
  Layers,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Upload,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { api, date, type Dashboard, type Config, type Health } from './api';
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  SectionTitle,
  Status,
  TextLink,
} from './components/ui';
export default function Overview() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/dashboard'),
  });
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<Config>('/config'),
  });
  const data = dashboard.data;
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<Health>('/health'),
  });
  const readiness = useQuery({
    queryKey: ['readiness'],
    queryFn: () => api<Health>('/readiness'),
    retry: false,
    refetchInterval: 30000,
  });
  return (
    <>
      <PageHeading
        eyebrow="YOUR KNOWLEDGE, CONNECTED"
        title="Your knowledge, made intelligent."
        description="One place to explore your company’s knowledge. Every answer, connected to its source."
        action={
          <Button
            variant="secondary"
            onClick={() => navigate('/documents', { state: { upload: true } })}
          >
            <Plus size={16} />
            Add knowledge
          </Button>
        }
      />
      <div
        className="overview-system-status"
        aria-label="Live system connectivity"
      >
        <span>
          <ShieldCheck size={14} />
          Live environment
        </span>
        <Badge tone={health.isSuccess ? 'green' : 'amber'}>
          API ·{' '}
          {health.isPending
            ? 'Checking'
            : health.isSuccess
              ? 'Connected'
              : 'Unavailable'}
        </Badge>
        <Badge tone={readiness.isSuccess ? 'green' : 'amber'}>
          PostgreSQL + Qdrant ·{' '}
          {readiness.isPending
            ? 'Checking'
            : readiness.isSuccess
              ? 'Ready'
              : 'Not ready'}
        </Badge>
        <button className="text-link" onClick={() => navigate('/settings')}>
          System details
          <ArrowRight size={12} />
        </button>
      </div>
      <section className="research-hero">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-content">
          <Badge tone="purple">
            <Sparkles size={12} />
            YOUR RESEARCH COMPANION
          </Badge>
          <h2>
            Where knowledge
            <br />
            <span>meets intelligence.</span>
          </h2>
          <p>
            Bring your questions. Discover the context, connections,
            <br className="desktop-only" /> and evidence already in your
            documents.
          </p>
          <form
            className="hero-question"
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim())
                navigate('/research', { state: { question } });
            }}
          >
            <Search size={20} />
            <input
              aria-label="Ask your knowledge base"
              placeholder="What would you like to understand?"
              maxLength={2000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button aria-label="Start research" disabled={!question.trim()}>
              <ArrowRight size={20} />
            </button>
          </form>
          <div className="hero-hint">
            <span className="status-dot" />
            Source-grounded search<span>·</span>
            {config.data?.llm_provider === 'none'
              ? 'Retrieved excerpts, clearly cited'
              : 'Evidence you can inspect'}
          </div>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="knowledge-node node-top">
            <FileText size={23} />
            <span>Documents</span>
            <i />
          </div>
          <div className="node-line line-one" />
          <div className="node-line line-two" />
          <div className="node-line line-three" />
          <div className="knowledge-core">
            <img src="/iaweb-logo.svg" alt="" />
            <span>
              KnowledgeOS
              <br />
              Connected knowledge
            </span>
          </div>
          <div className="knowledge-node node-left">
            <Layers size={20} />
            <span>Context</span>
          </div>
          <div className="knowledge-node node-right">
            <Sparkles size={20} />
            <span>Clarity</span>
            <i />
          </div>
          <span className="illustration-dot dot-one" />
          <span className="illustration-dot dot-two" />
        </div>
      </section>
      {dashboard.isPending ? (
        <Loading />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} retry={() => dashboard.refetch()} />
      ) : (
        data && (
          <>
            <div className="stats-grid">
              {[
                {
                  label: 'Indexed documents',
                  value: data.documents,
                  icon: FileText,
                  note: 'Ready for research',
                  color: 'purple',
                },
                {
                  label: 'Indexed chunks',
                  value: data.chunks,
                  icon: Layers,
                  note: 'Searchable passages',
                  color: 'blue',
                },
                {
                  label: 'Conversations',
                  value: data.conversations,
                  icon: MessageSquare,
                  note: 'Research threads',
                  color: 'green',
                },
                {
                  label: 'Questions asked',
                  value: data.queries,
                  icon: Search,
                  note: 'Across all conversations',
                  color: 'orange',
                },
              ].map((item) => (
                <div className="stat-card" key={item.label}>
                  <div className="stat-label">
                    {item.label}
                    <span className={`stat-icon ${item.color}`}>
                      <item.icon size={17} />
                    </span>
                  </div>
                  <strong>{item.value.toLocaleString()}</strong>
                  <span className="stat-note">{item.note}</span>
                </div>
              ))}
            </div>
            <div className="overview-main-grid">
              <section className="panel recent-documents">
                <SectionTitle
                  title="Your knowledge base"
                  description="The latest additions to your collective knowledge."
                  action={
                    <TextLink onClick={() => navigate('/documents')}>
                      View all
                    </TextLink>
                  }
                />
                {data.recent_documents.length ? (
                  <div className="document-mini-list">
                    {data.recent_documents.slice(0, 4).map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() =>
                          navigate('/documents', {
                            state: { documentId: doc.id },
                          })
                        }
                      >
                        <span
                          className={`file-icon ${doc.filename.endsWith('.pdf') ? 'pdf' : ''}`}
                        >
                          <FileText size={20} />
                        </span>
                        <span className="mini-doc-title">
                          <strong>{doc.title}</strong>
                          <small>
                            {doc.category} <span>·</span> {date(doc.created_at)}
                          </small>
                        </span>
                        <Status status={doc.status} />
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Make room for your knowledge"
                    description="Upload your first document to begin exploring."
                    action={
                      <Button
                        variant="secondary"
                        onClick={() =>
                          navigate('/documents', { state: { upload: true } })
                        }
                      >
                        <Upload size={15} />
                        Upload a document
                      </Button>
                    }
                  />
                )}
                <div className="panel-bottom">
                  <Database size={14} />
                  {data.categories.length} categor
                  {data.categories.length === 1 ? 'y' : 'ies'} across your
                  workspace<span>Always connected to the source</span>
                </div>
              </section>
              <section className="panel activity-chart">
                <SectionTitle
                  title="Research activity"
                  description="Questions asked over the last 7 days."
                  action={<Badge>Last 7 days</Badge>}
                />
                {data.query_trend.length && data.queries > 0 ? (
                  <>
                    <div className="chart-head">
                      <strong>
                        {data.query_trend.reduce(
                          (sum, point) => sum + point.count,
                          0,
                        )}
                      </strong>
                      <span>questions in this period</span>
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.query_trend}>
                          <defs>
                            <linearGradient
                              id="activityFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--indigo)"
                                stopOpacity={0.25}
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
                                { weekday: 'short' },
                              )
                            }
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10, fill: 'var(--muted)' }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--panel)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              fontSize: 12,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            name="Questions"
                            stroke="var(--indigo)"
                            strokeWidth={2.5}
                            fill="url(#activityFill)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <Empty
                    title="Your next question starts a trend"
                    description="Research activity will appear here after your first question."
                    action={
                      <TextLink onClick={() => navigate('/research')}>
                        Start researching
                      </TextLink>
                    }
                  />
                )}
              </section>
            </div>
          </>
        )
      )}
      {data && (
        <div className="overview-insights-grid">
          <section className="panel">
            <SectionTitle
              title="Knowledge by category"
              description="Document distribution across your workspace."
              action={<Badge>{data.categories.length} categories</Badge>}
            />
            {data.categories.length ? (
              <div className="overview-category-list">
                {data.categories.map((category) => (
                  <div key={category.name}>
                    <div>
                      <span>{category.name}</span>
                      <strong>
                        {category.count}{' '}
                        {category.count === 1 ? 'document' : 'documents'}
                      </strong>
                    </div>
                    <progress
                      aria-label={`${category.name} documents`}
                      value={category.count}
                      max={Math.max(
                        1,
                        ...data.categories.map((item) => item.count),
                      )}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="A place for every kind of knowledge"
                description="Document categories will appear after your first upload."
              />
            )}
          </section>
          <section className="panel">
            <SectionTitle
              title="Recent activity"
              description="The latest recorded additions and research."
              action={<Activity size={17} />}
            />
            {data.recent_activity.length ? (
              <ul className="overview-activity-list">
                {data.recent_activity.slice(0, 5).map((event, index) => (
                  <li key={`${event.type}-${event.id || index}`}>
                    <span className="soft-icon">
                      {event.type === 'document' ? (
                        <FileText size={16} />
                      ) : (
                        <MessageSquare size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{event.title || 'Workspace event'}</strong>
                      <span>{event.description || event.type}</span>
                    </div>
                    {event.created_at && (
                      <time dateTime={event.created_at}>
                        {date(event.created_at)}
                      </time>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                title="Your workspace story starts here"
                description="Document uploads and research questions will appear as they happen."
              />
            )}
          </section>
        </div>
      )}
      <div className="overview-bottom-grid">
        <section className="explore-card">
          <span className="soft-icon">
            <BookOpen size={23} />
          </span>
          <div>
            <div className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</div>
            <h3>Find the answer behind the answer.</h3>
            <p>
              Explore source passages, relevance scores, and the retrieval
              trace.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/research')}>
            Open research
            <ArrowRight size={15} />
          </Button>
        </section>
        <button
          className="architecture-card"
          onClick={() => navigate('/architecture')}
        >
          <span className="eyebrow">BUILT TO BE UNDERSTOOD</span>
          <h3>
            See what’s under the hood
            <ArrowUpRight size={18} />
          </h3>
          <p>From document to grounded answer.</p>
          <div className="mini-pipeline">
            <span>Ingest</span>
            <ArrowRight size={12} />
            <span>Retrieve</span>
            <ArrowRight size={12} />
            <span>Understand</span>
          </div>
        </button>
      </div>
    </>
  );
}
