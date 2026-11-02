import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  CartesianGrid,
} from 'recharts';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  RotateCw,
  ShieldCheck,
  Unplug,
  FileText,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { api, date, type Document } from './api';
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
} from './components/ui';
import './integrations.css';

type ScopedDocument = Document & { employee_available?: boolean };

type Credential = {
  id: string;
  prefix: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};
export type Integration = {
  id: string;
  name: string;
  enabled: boolean;
  allowed_origins: string[];
  document_ids: string[];
  rate_limit_per_minute: number;
  created_at: string;
  keys: Credential[];
};
type EnterpriseActivity = {
  integrations_active: number;
  query_count: number;
  abstention_count: number;
  provider_error_count: number;
  no_result_count: number;
  average_latency_ms: number;
  queries_by_integration: { id: string; name: string; count: number }[];
  recent_events: {
    id: string;
    integration_id: string | null;
    mode: string;
    latency_ms: number;
    created_at: string;
    channel: string;
  }[];
  query_trend: { date: string; count: number }[];
};
type IssuedKey = {
  id: string;
  secret: string;
  prefix: string;
  expires_at: string;
};
const endpoint = '/admin/integrations';
function active(key: Credential) {
  return !key.revoked_at && new Date(key.expires_at).getTime() > Date.now();
}
function problem(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
}

export default function Integrations() {
  const cache = useQueryClient();
  const list = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<Integration[]>(endpoint),
  });
  const documents = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<ScopedDocument[]>('/documents'),
  });
  const [editor, setEditor] = useState<Integration | 'new' | null>(null);
  const [credentialFor, setCredentialFor] = useState<Integration | null>(null);
  const [rotation, setRotation] = useState<Credential | null>(null);
  const [revoke, setRevoke] = useState<{
    integration: Integration;
    key: Credential;
  } | null>(null);
  const [publication, setPublication] = useState<ScopedDocument | null>(null);
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const data = list.data ?? [];
  const keys = data.flatMap((item) => item.keys);
  const accessibleDocuments = new Set(
    data.filter((item) => item.enabled).flatMap((item) => item.document_ids),
  );
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ['integrations'] });
  }
  async function save(value: IntegrationForm) {
    setBusy(true);
    setError('');
    try {
      await api(
        editor === 'new'
          ? endpoint
          : `${endpoint}/${(editor as Integration).id}`,
        {
          method: editor === 'new' ? 'POST' : 'PATCH',
          body: JSON.stringify(
            editor === 'new'
              ? {
                  name: value.name,
                  allowed_origins: value.allowed_origins,
                  document_ids: value.document_ids,
                  rate_limit_per_minute: value.rate_limit_per_minute,
                }
              : value,
          ),
        },
      );
      setEditor(null);
      await refresh();
    } catch (cause) {
      setError(problem(cause));
    } finally {
      setBusy(false);
    }
  }
  async function issue() {
    if (!credentialFor) return;
    setBusy(true);
    setError('');
    try {
      // Deliberately avoid the query/mutation cache for one-time raw credentials.
      const value = await api<IssuedKey>(
        `${endpoint}/${credentialFor.id}/keys${rotation ? `/${rotation.id}/rotate` : ''}`,
        { method: 'POST', body: JSON.stringify({ expires_in_days: days }) },
      );
      setCredentialFor(null);
      setRotation(null);
      setCopied(false);
      setIssued(value);
      await refresh();
    } catch (cause) {
      setError(problem(cause));
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function revokeKey() {
    if (!revoke) return;
    setBusy(true);
    setError('');
    try {
      await api(`${endpoint}/${revoke.integration.id}/keys/${revoke.key.id}`, {
        method: 'DELETE',
      });
      setRevoke(null);
      await refresh();
    } catch (cause) {
      setError(problem(cause));
    } finally {
      setBusy(false);
    }
  }
  async function changePublication() {
    if (!publication) return;
    setBusy(true);
    setError('');
    try {
      await api(`/documents/${publication.id}/access`, {
        method: 'PATCH',
        body: JSON.stringify({
          employee_available: !publication.employee_available,
        }),
      });
      setPublication(null);
      await cache.invalidateQueries({ queryKey: ['documents'] });
    } catch (cause) {
      setError(problem(cause));
    } finally {
      setBusy(false);
    }
  }
  async function copySecret() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.secret);
      setCopied(true);
    } catch {
      setError(
        'Clipboard unavailable. Select and copy the credential manually.',
      );
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CONNECTED, WITH CONTROL"
        title="Integrations"
        description="Connect an employee portal to the knowledge it is allowed to use."
        action={
          <Button
            onClick={() => {
              setError('');
              setEditor('new');
            }}
          >
            <Plus size={16} />
            Create integration
          </Button>
        }
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} retry={() => void list.refetch()} />
      ) : (
        <>
          <div className="stats-grid integration-stats">
            {[
              [
                'Active integrations',
                data.filter((item) => item.enabled).length,
              ],
              [
                'Valid credentials',
                data
                  .filter((item) => item.enabled)
                  .flatMap((item) => item.keys)
                  .filter(active).length,
              ],
              ['Documents in active scopes', accessibleDocuments.size],
              [
                'Revoked credentials',
                keys.filter((key) => !!key.revoked_at).length,
              ],
            ].map(([label, value]) => (
              <div className="stat-card" key={String(label)}>
                <span className="stat-label">{label}</span>
                <strong>{value}</strong>
                <span className="stat-note">
                  Derived from saved integration records
                </span>
              </div>
            ))}
          </div>
          <div className="integration-boundary">
            <ShieldCheck size={21} />
            <div>
              <strong>Default-deny document access</strong>
              <p>
                An integration starts with no documents. Its server credentials
                stay in the company backend; browsers use short-lived employee
                sessions.
              </p>
            </div>
          </div>
          <section className="panel integration-publication">
            <details>
              <summary>
                <FileText size={18} />
                <span>Employee document availability</span>
                <Badge>
                  {documents.isPending
                    ? 'Checking…'
                    : documents.isError
                      ? 'Unavailable'
                      : `${documents.data?.filter((doc) => doc.employee_available).length ?? 0} published`}
                </Badge>
              </summary>
              <p>
                Publishing makes a document eligible for employee retrieval.
                Each integration must also explicitly include it in its own
                scope. Existing documents remain administrator-only until you
                publish them.
              </p>
              {documents.isError ? (
                <ErrorState
                  error={documents.error}
                  retry={() => void documents.refetch()}
                />
              ) : documents.isPending ? (
                <p role="status">Loading documents…</p>
              ) : (
                <div className="integration-publication-list">
                  {documents.data?.map((doc) => (
                    <div key={doc.id}>
                      <span>
                        <strong>{doc.title}</strong>
                        <small>
                          {doc.category} · {doc.status}
                        </small>
                      </span>
                      <Badge
                        tone={doc.employee_available ? 'green' : 'neutral'}
                      >
                        {doc.employee_available
                          ? 'Employee available'
                          : 'Admin only'}
                      </Badge>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setError('');
                          setPublication(doc);
                        }}
                      >
                        {doc.employee_available
                          ? 'Restrict to admins'
                          : 'Publish'}
                      </Button>
                    </div>
                  ))}
                  {!documents.data?.length && <p>No documents available.</p>}
                </div>
              )}
            </details>
          </section>
          {!data.length ? (
            <section className="panel">
              <Empty
                title="Your first connection starts here"
                description="Create an integration, select its documents, then issue a server credential."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setError('');
                      setEditor('new');
                    }}
                  >
                    Create integration
                  </Button>
                }
              />
            </section>
          ) : (
            <div className="integration-grid">
              {data.map((item) => (
                <section className="panel integration-card" key={item.id}>
                  <header>
                    <span className="integration-symbol">
                      <Unplug size={22} />
                    </span>
                    <div>
                      <h2>{item.name}</h2>
                      <small>Created {date(item.created_at)}</small>
                    </div>
                    <Badge tone={item.enabled ? 'green' : 'neutral'}>
                      {item.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </header>
                  <dl className="integration-facts">
                    <div>
                      <dt>Document scope</dt>
                      <dd>
                        <FileText size={14} />
                        {item.document_ids.length
                          ? `${item.document_ids.length} selected document${item.document_ids.length === 1 ? '' : 's'}`
                          : 'No documents · access denied'}
                      </dd>
                    </div>
                    <div>
                      <dt>Employee-eligible documents</dt>
                      <dd>
                        {documents.isPending
                          ? 'Checking…'
                          : documents.isError
                            ? 'Status unavailable'
                            : (documents.data?.filter(
                                (doc) =>
                                  item.document_ids.includes(doc.id) &&
                                  doc.employee_available &&
                                  doc.status === 'indexed',
                              ).length ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt>Request limit</dt>
                      <dd>{item.rate_limit_per_minute} / minute</dd>
                    </div>
                    <div>
                      <dt>Allowed portal origins</dt>
                      <dd>
                        {item.allowed_origins.length
                          ? item.allowed_origins.map((origin) => (
                              <code key={origin}>{origin}</code>
                            ))
                          : 'No browser origins allowed'}
                      </dd>
                    </div>
                  </dl>
                  <div className="integration-card-actions">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setError('');
                        setEditor(item);
                      }}
                    >
                      Manage access
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!item.enabled}
                      onClick={() => {
                        setError('');
                        setDays(30);
                        setRotation(null);
                        setCredentialFor(item);
                      }}
                    >
                      <KeyRound size={14} />
                      Issue credential
                    </Button>
                  </div>
                  <div className="integration-key-list">
                    <h3>
                      Server credentials <span>{item.keys.length}</span>
                    </h3>
                    {!item.keys.length ? (
                      <p className="integration-muted">
                        No credentials issued.
                      </p>
                    ) : (
                      item.keys.map((key) => (
                        <div className="integration-key" key={key.id}>
                          <div>
                            <code>{key.prefix}…</code>
                            <Badge
                              tone={
                                key.revoked_at
                                  ? 'red'
                                  : active(key)
                                    ? 'green'
                                    : 'amber'
                              }
                            >
                              {key.revoked_at
                                ? 'Revoked'
                                : active(key)
                                  ? 'Active'
                                  : 'Expired'}
                            </Badge>
                            <small>
                              Expires {date(key.expires_at)} ·{' '}
                              {key.last_used_at
                                ? `Last used ${date(key.last_used_at)}`
                                : 'Never used'}
                            </small>
                          </div>
                          <div className="integration-key-actions">
                            {!key.revoked_at && (
                              <>
                                <button
                                  className="icon-button"
                                  title="Rotate credential"
                                  aria-label={`Rotate credential ${key.prefix}`}
                                  disabled={!item.enabled}
                                  onClick={() => {
                                    setError('');
                                    setDays(30);
                                    setRotation(key);
                                    setCredentialFor(item);
                                  }}
                                >
                                  <RotateCw size={15} />
                                </button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => {
                                    setError('');
                                    setRevoke({ integration: item, key });
                                  }}
                                >
                                  Revoke
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      <IntegrationActivity />
      <section className="panel integration-install">
        <div>
          <span className="soft-icon">
            <Code2 size={21} />
          </span>
          <div>
            <h2>Integrate through your portal backend</h2>
            <p>
              The portal verifies its employee session before exchanging a
              server credential for a short-lived KnowledgeOS token.
            </p>
          </div>
        </div>
        <ol>
          <li>
            Store the one-time credential in your portal’s server-side secret
            store.
          </li>
          <li>
            Resolve the employee identity from the authenticated portal session.
          </li>
          <li>
            Request an employee session through the versioned integration API.
          </li>
          <li>
            Keep the returned short-lived token in browser memory. Send requests
            through the standalone widget or your own frontend.
          </li>
        </ol>
        <pre aria-label="Server-side integration configuration">
          <code>
            {
              'KNOWLEDGEOS_URL=https://knowledge.example.com\nKNOWLEDGEOS_INTEGRATION_KEY=<server-side-secret>\n# Never prefix this secret with VITE_ or expose it in HTML.'
            }
          </code>
        </pre>
        <p className="integration-muted">
          <ExternalLink size={13} />
          Use the server-side API documentation for endpoint contracts. Keep the
          integration credential exclusively in your portal backend.
        </p>
      </section>
      <Modal
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditor(null);
            setError('');
          }
        }}
        title={
          editor === 'new' ? 'Create integration' : 'Manage integration access'
        }
        description="Select exactly which documents this integration may retrieve."
        wide
      >
        {editor && (
          <IntegrationEditor
            key={typeof editor === 'string' ? 'new' : editor.id}
            initial={editor === 'new' ? undefined : editor}
            documents={documents.data ?? []}
            documentsLoading={documents.isPending}
            documentsError={documents.error}
            retryDocuments={() => void documents.refetch()}
            onSave={save}
            busy={busy}
            error={error}
          />
        )}
      </Modal>
      <Modal
        open={!!credentialFor}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setCredentialFor(null);
            setRotation(null);
            setError('');
          }
        }}
        title={
          rotation ? 'Rotate server credential' : 'Issue server credential'
        }
        description={
          rotation
            ? 'The previous credential will be revoked when the replacement is issued.'
            : 'The full secret is displayed once, immediately after creation.'
        }
      >
        <div className="modal-body integration-form">
          <p>
            Integration: <strong>{credentialFor?.name}</strong>
          </p>
          <label htmlFor="credential-expiry">Expires in days</label>
          <input
            id="credential-expiry"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
          {error && (
            <p role="alert" className="integration-error">
              {error}
            </p>
          )}
          <Button
            disabled={busy || !Number.isInteger(days) || days < 1 || days > 365}
            onClick={() => void issue()}
          >
            {busy
              ? 'Issuing…'
              : rotation
                ? 'Rotate credential'
                : 'Issue credential'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!issued}
        onOpenChange={(open) => {
          if (!open) {
            setIssued(null);
            setCopied(false);
            setError('');
          }
        }}
        title="Save your server credential"
        description="This is the only time the complete secret is shown."
      >
        <div className="modal-body integration-form">
          <div className="integration-secret-note">
            <KeyRound size={20} />
            <p>
              Store this in your portal backend’s secret manager. Closing this
              dialog removes it from this screen. It cannot be retrieved again.
            </p>
          </div>
          <output
            className="integration-secret"
            aria-label="One-time integration secret"
          >
            {issued?.secret}
          </output>
          <Button onClick={() => void copySecret()} variant="secondary">
            {copied ? <Check size={15} /> : <Copy size={15} />}{' '}
            {copied ? 'Copied' : 'Copy credential'}
          </Button>
          <p className="integration-muted">
            Expires {issued && date(issued.expires_at)}. A forgotten secret must
            be rotated or revoked.
          </p>
          {error && (
            <p role="alert" className="integration-error">
              {error}
            </p>
          )}
          <Button
            onClick={() => {
              setIssued(null);
              setCopied(false);
              setError('');
            }}
          >
            I have saved it
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!publication}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPublication(null);
            setError('');
          }
        }}
        title={
          publication?.employee_available
            ? 'Restrict document to administrators?'
            : 'Publish document for employee access?'
        }
        description="Document publication and integration scopes are separate permissions."
      >
        <div className="modal-body integration-form">
          <p>
            <strong>{publication?.title}</strong>
          </p>
          <p>
            {publication?.employee_available
              ? 'Employee integrations will no longer be allowed to retrieve this document, even if it remains in their scope.'
              : 'This allows employee integrations to retrieve the document only when their configured scope explicitly includes it.'}
          </p>
          {error && (
            <p className="integration-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy} onClick={() => void changePublication()}>
            {busy
              ? 'Saving…'
              : publication?.employee_available
                ? 'Confirm restriction'
                : 'Publish document'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setRevoke(null);
            setError('');
          }
        }}
        title="Revoke this credential?"
        description="Clients using this credential will lose access."
      >
        <div className="modal-body integration-form">
          <p>
            Revoke <code>{revoke?.key.prefix}…</code> for{' '}
            <strong>{revoke?.integration.name}</strong>? Update the company
            backend before replacing its credential.
          </p>
          {error && (
            <p role="alert" className="integration-error">
              {error}
            </p>
          )}
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => void revokeKey()}
          >
            {busy ? 'Revoking…' : 'Confirm revocation'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

type IntegrationForm = {
  name: string;
  enabled: boolean;
  allowed_origins: string[];
  document_ids: string[];
  rate_limit_per_minute: number;
};
function IntegrationEditor({
  initial,
  documents,
  documentsLoading,
  documentsError,
  retryDocuments,
  onSave,
  busy,
  error,
}: {
  initial?: Integration;
  documents: ScopedDocument[];
  documentsLoading: boolean;
  documentsError: unknown;
  retryDocuments: () => void;
  onSave: (value: IntegrationForm) => Promise<void>;
  busy: boolean;
  error: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [origins, setOrigins] = useState(
    initial?.allowed_origins.join('\n') ?? '',
  );
  const [selected, setSelected] = useState(initial?.document_ids ?? []);
  const [limit, setLimit] = useState(initial?.rate_limit_per_minute ?? 60);
  const [validation, setValidation] = useState('');
  const [search, setSearch] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setValidation('');
    const allowed_origins = [
      ...new Set(
        origins
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    try {
      for (const origin of allowed_origins) {
        const url = new URL(origin);
        if (
          url.origin !== origin ||
          !['https:', 'http:'].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error(
            'Enter exact HTTP(S) origins, without a path, credentials or trailing slash.',
          );
        if (
          url.protocol === 'http:' &&
          !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        )
          throw new Error(
            'Use HTTPS for portal origins outside local development.',
          );
      }
    } catch (cause) {
      setValidation(problem(cause));
      return;
    }
    if (
      !name.trim() ||
      name.trim().length > 120 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 600
    ) {
      setValidation(
        'Enter a name of 1–120 characters and a request limit between 1 and 600.',
      );
      return;
    }
    await onSave({
      name: name.trim(),
      enabled,
      allowed_origins,
      document_ids: selected,
      rate_limit_per_minute: limit,
    });
  }
  const visible = documents.filter((doc) =>
    `${doc.title} ${doc.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <form className="modal-body integration-form" onSubmit={submit}>
      <label htmlFor="integration-name">Integration name</label>
      <input
        id="integration-name"
        required
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy}
      />
      {initial && (
        <label className="integration-checkbox">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={busy}
          />
          Integration enabled
        </label>
      )}
      <div className="integration-form-grid">
        <div>
          <label htmlFor="integration-rate">Requests per minute</label>
          <input
            id="integration-rate"
            type="number"
            min={1}
            max={600}
            required
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor="integration-origins">Allowed portal origins</label>
          <textarea
            id="integration-origins"
            rows={3}
            placeholder={'https://intranet.example.com\nhttp://127.0.0.1:8090'}
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>
      <p className="integration-muted">
        One origin per line. These are browser origins, not API credentials.
        Empty means no browser origin is allowed.
      </p>
      <fieldset className="integration-scope">
        <legend>
          Authorized documents <span>{selected.length} selected</span>
        </legend>
        <p>
          No documents are selected automatically. An empty scope denies all
          document retrieval. Selecting a document here does not publish it;
          administrator-only documents must be published separately before
          employees can retrieve them.
        </p>
        {documentsError ? (
          <ErrorState error={documentsError} retry={retryDocuments} />
        ) : documentsLoading ? (
          <p role="status">Loading documents…</p>
        ) : (
          <>
            <label htmlFor="scope-search" className="sr-only">
              Search scope documents
            </label>
            <input
              id="scope-search"
              placeholder="Search documents or categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="integration-document-list">
              {visible.map((doc) => (
                <label key={doc.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(doc.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, doc.id]
                          : selected.filter((id) => id !== doc.id),
                      )
                    }
                    disabled={busy}
                  />
                  <span>
                    <strong>{doc.title}</strong>
                    <small>
                      {doc.category} · {doc.status} ·{' '}
                      {doc.employee_available
                        ? 'Employee available'
                        : 'Admin only'}
                    </small>
                  </span>
                </label>
              ))}
              {!visible.length && (
                <p className="integration-muted">
                  {documents.length
                    ? 'No matching documents.'
                    : 'No documents available. Upload documents in Knowledge Base.'}
                </p>
              )}
            </div>
          </>
        )}
      </fieldset>
      {(validation || error) && (
        <p role="alert" className="integration-error">
          {validation || error}
        </p>
      )}
      <Button
        type="submit"
        disabled={busy || documentsLoading || !!documentsError}
      >
        {busy
          ? 'Saving…'
          : initial
            ? 'Save access settings'
            : 'Create integration'}
      </Button>
    </form>
  );
}

function IntegrationActivity() {
  const [days, setDays] = useState(7);
  const activity = useQuery({
    queryKey: ['enterprise-analytics', days],
    queryFn: () => api<EnterpriseActivity>(`/admin/analytics?days=${days}`),
  });
  const data = activity.data;
  return (
    <section className="panel integration-activity">
      <header>
        <div>
          <h2>Integration activity</h2>
          <p>
            Recorded requests, source gaps and provider failures. Employee
            questions and identities are redacted.
          </p>
        </div>
        <div className="segmented">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              className={days === value ? 'active' : ''}
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              {value} days
            </button>
          ))}
        </div>
      </header>
      {activity.isPending ? (
        <Loading />
      ) : activity.isError ? (
        <ErrorState
          error={activity.error}
          retry={() => void activity.refetch()}
        />
      ) : (
        data && (
          <>
            <div className="integration-traffic-metrics">
              {[
                ['Questions', data.query_count],
                ['No retrieved results', data.no_result_count],
                ['Abstentions', data.abstention_count],
                ['Provider errors', data.provider_error_count],
                ['Average latency', `${data.average_latency_ms} ms`],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            {!data.query_count ? (
              <Empty
                title="No integration traffic yet"
                description="Execute an authorized request through a portal integration to see its recorded activity here."
              />
            ) : (
              <div className="integration-traffic-grid">
                <div>
                  <h3>Questions over time</h3>
                  <div className="integration-trend">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.query_trend}
                        margin={{ top: 12, right: 12, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 4"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => String(value).slice(5)}
                          tick={{ fontSize: 10, fill: 'var(--muted)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--panel)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            color: 'var(--text)',
                            fontSize: 12,
                          }}
                        />
                        <Area
                          dataKey="count"
                          name="Requests"
                          type="monotone"
                          stroke="var(--indigo)"
                          fill="var(--indigo-soft)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="integration-ranking">
                  <h3>Requests by integration</h3>
                  {data.queries_by_integration.length ? (
                    data.queries_by_integration.map((item) => (
                      <div key={item.id}>
                        <span>{item.name}</span>
                        <strong>{item.count}</strong>
                        <progress
                          value={item.count}
                          max={Math.max(
                            ...data.queries_by_integration.map(
                              (row) => row.count,
                            ),
                            1,
                          )}
                          aria-label={`${item.name}: ${item.count} requests`}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="integration-muted">
                      No integration-specific requests in this period.
                    </p>
                  )}
                </div>
              </div>
            )}
            {!!data.recent_events.length && (
              <details className="integration-events">
                <summary>Recent request events</summary>
                <div className="integration-events-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Integration</th>
                        <th>Channel</th>
                        <th>Mode</th>
                        <th>Latency</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_events.map((event) => (
                        <tr key={event.id}>
                          <td>
                            {data.queries_by_integration.find(
                              (item) => item.id === event.integration_id,
                            )?.name ??
                              (event.integration_id
                                ? 'Unavailable integration'
                                : 'Admin Playground')}
                          </td>
                          <td>{event.channel}</td>
                          <td>{event.mode.replaceAll('_', ' ')}</td>
                          <td>{event.latency_ms} ms</td>
                          <td>{date(event.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )
      )}
    </section>
  );
}
