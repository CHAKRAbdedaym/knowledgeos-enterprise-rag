import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileText,
  Folder,
  Grid2X2,
  Layers,
  List,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  api,
  bytes,
  date,
  messageError,
  uploadDocument,
  type Config,
  type Document,
} from './api';
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
  Spinner,
  Status,
} from './components/ui';
export default function Documents() {
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filters, setFilters] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [tab, setTab] = useState<'preview' | 'chunks' | 'details'>('preview');
  const docs = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<Document[]>('/documents'),
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === 'indexing') ? 3000 : false,
  });
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<Config>('/config'),
  });
  const detail = useQuery({
    queryKey: ['document', selected],
    queryFn: () => api<Document>(`/documents/${selected}`),
    enabled: !!selected,
  });
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['documents'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
    client.invalidateQueries({ queryKey: ['analytics'] });
    client.invalidateQueries({ queryKey: ['document', selected] });
  };
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first');
      return uploadDocument(file, category, tags, setProgress);
    },
    onSuccess: () => {
      invalidate();
      setUpload(false);
      setFile(null);
      setTags('');
      setProgress(0);
    },
    onError: (error) => setUploadError(messageError(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api<void>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: (_result, deletedId) => {
      setDeleting(null);
      setSelected(null);
      client.removeQueries({ queryKey: ['document', deletedId] });
      client.invalidateQueries({ queryKey: ['documents'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      client.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
  const reindex = useMutation({
    mutationFn: (id: string) =>
      api<Document>(`/documents/${id}/reindex`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const [reindexConfirm, setReindexConfirm] = useState(false);
  useEffect(() => {
    const state = location.state as {
      upload?: boolean;
      documentId?: string;
    } | null;
    if (state?.upload) setUpload(true);
    if (state?.documentId) setSelected(state.documentId);
    if (state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);
  const categories = [...new Set(docs.data?.map((d) => d.category) || [])];
  const filtered = (docs.data || []).filter(
    (d) =>
      `${d.title} ${d.filename} ${d.tags.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (categoryFilter === 'all' || d.category === categoryFilter) &&
      (type === 'all' || d.filename.toLowerCase().endsWith(type)) &&
      (status === 'all' || d.status === status) &&
      (period === 'all' ||
        new Date(d.created_at).valueOf() >
          Date.now() - Number(period) * 86400000),
  );
  function chooseFile(next: File | undefined) {
    if (!next || uploadMutation.isPending) return;
    setFile(null);
    setUploadError('');
    setProgress(0);
    const ext = next.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt', 'md'].includes(ext || '')) {
      setUploadError('Supported files: PDF, TXT, Markdown.');
      return;
    }
    if (next.size > (config.data?.max_upload_mb || 10) * 1048576) {
      setUploadError(
        `File exceeds the ${config.data?.max_upload_mb || 10} MB limit.`,
      );
      return;
    }
    setFile(next);
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR SINGLE SOURCE OF CONTEXT"
        title="Knowledge Base"
        description="Give your team’s knowledge a place to connect. Upload, organize, and explore."
        action={
          <Button onClick={() => setUpload(true)}>
            <Plus size={17} />
            Upload document
          </Button>
        }
      />
      <div className="document-summary">
        <span className="soft-icon">
          <DatabaseIcon />
        </span>
        <div>
          <strong>{docs.data?.length ?? '—'} documents</strong>
          <span>
            {docs.data?.filter((d) => d.status === 'indexed').length ?? '—'}{' '}
            indexed and ready to explore
          </span>
        </div>
        <Badge tone="purple">
          <Layers size={12} />
          {docs.data?.reduce((n, d) => n + d.chunk_count, 0) ?? '—'} searchable
          chunks
        </Badge>
      </div>
      <section className="panel document-panel">
        <div className="document-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search documents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents, tags, and more…"
            />
            {search && (
              <button
                className="icon-button"
                onClick={() => setSearch('')}
                aria-label="Clear document search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Button
            variant="secondary"
            className={filters ? 'filter-active' : ''}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={15} />
            Filters
          </Button>
          <div className="view-toggle">
            <button
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={17} />
            </button>
            <button
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <Grid2X2 size={17} />
            </button>
          </div>
        </div>
        {filters && (
          <div className="filter-row">
            <label>
              File type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="all">All types</option>
                <option value=".pdf">PDF</option>
                <option value=".md">Markdown</option>
                <option value=".txt">Text</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="indexed">Indexed</option>
                <option value="indexing">Indexing</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label>
              Added
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="all">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <Button
              variant="ghost"
              onClick={() => {
                setType('all');
                setStatus('all');
                setPeriod('all');
                setCategoryFilter('all');
                setSearch('');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        {docs.isPending ? (
          <Loading />
        ) : docs.isError ? (
          <ErrorState error={docs.error} retry={() => docs.refetch()} />
        ) : !filtered.length ? (
          <Empty
            title={
              docs.data?.length
                ? 'No matching documents'
                : 'Your knowledge starts here'
            }
            description={
              docs.data?.length
                ? 'Try a different search or clear the filters.'
                : 'Add a PDF, Markdown, or text document to make it searchable.'
            }
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  docs.data?.length
                    ? (setSearch(''),
                      setCategoryFilter('all'),
                      setType('all'),
                      setStatus('all'),
                      setPeriod('all'))
                    : setUpload(true)
                }
              >
                {docs.data?.length
                  ? 'Clear filters'
                  : 'Upload your first document'}
              </Button>
            }
          />
        ) : view === 'list' ? (
          <div className="table-scroll">
            <table className="document-table">
              <thead>
                <tr>
                  <th>
                    Document name <ArrowDown size={11} />
                  </th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Chunks</th>
                  <th>Date added</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <button
                        className="document-name"
                        onClick={() => {
                          setSelected(doc.id);
                          setTab('preview');
                        }}
                      >
                        <span
                          className={`file-icon ${doc.filename.endsWith('.pdf') ? 'pdf' : ''}`}
                        >
                          <FileText size={20} />
                        </span>
                        <span>
                          <strong>{doc.title}</strong>
                          <small>
                            {doc.filename.split('.').pop()?.toUpperCase()}{' '}
                            <span>·</span> {bytes(doc.size_bytes)}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="category-label">
                        <Folder size={13} />
                        {doc.category}
                      </span>
                    </td>
                    <td>
                      <Status status={doc.status} />
                    </td>
                    <td className="number-cell">{doc.chunk_count}</td>
                    <td className="muted">{date(doc.created_at)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${doc.title}`}
                        onClick={() => setSelected(doc.id)}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="document-grid">
            {filtered.map((doc) => (
              <button
                className="document-card"
                key={doc.id}
                onClick={() => setSelected(doc.id)}
              >
                <div className="document-card-top">
                  <span className="file-icon">
                    <FileText size={23} />
                  </span>
                  <Status status={doc.status} />
                </div>
                <h3>{doc.title}</h3>
                <p>
                  {doc.category} · {bytes(doc.size_bytes)}
                </p>
                <div className="tag-row">
                  {doc.tags.slice(0, 3).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
                <div className="document-card-footer">
                  <span>{doc.chunk_count} chunks</span>
                  <span>{date(doc.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        {docs.isSuccess && (
          <div className="table-footer">
            <span>
              Showing {filtered.length} of {docs.data.length} documents
            </span>
            <span>All knowledge. One workspace.</span>
          </div>
        )}
      </section>
      <div className="inline-tip">
        <ShieldIcon />
        <p>
          <strong>Your sources stay in view.</strong> Every retrieved passage
          links back to its original document. Uploaded files are stored in your
          local environment.
        </p>
        <button className="text-link" onClick={() => navigate('/architecture')}>
          How indexing works
          <ArrowUpRight size={14} />
        </button>
      </div>
      <Modal
        open={upload}
        onOpenChange={(open) => {
          if (!uploadMutation.isPending) {
            setUpload(open);
            setUploadError('');
          }
        }}
        title="Add to your knowledge"
        description="Upload a document to extract, index, and make its contents searchable."
      >
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            setUploadError('');
            uploadMutation.mutate();
          }}
        >
          <input
            ref={input}
            type="file"
            accept=".pdf,.txt,.md"
            className="sr-only"
            aria-label="Choose document file"
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          <button
            disabled={uploadMutation.isPending}
            type="button"
            className={`drop-zone ${drag ? 'dragging' : ''}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              chooseFile(e.dataTransfer.files[0]);
            }}
          >
            <span className="empty-icon">
              {file ? <FileText size={27} /> : <Upload size={27} />}
            </span>
            <strong>
              {file ? file.name : 'Drop a document here, or browse'}
            </strong>
            <span>
              {file
                ? bytes(file.size)
                : `PDF, TXT, Markdown · up to ${config.data?.max_upload_mb || 10} MB`}
            </span>
            {file && (
              <Badge tone="green">
                <Check size={11} />
                Ready to upload
              </Badge>
            )}
          </button>
          <div className="form-row">
            <label>
              Category
              <input
                maxLength={80}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                placeholder="e.g. Engineering"
              />
            </label>
            <label>
              Tags <span className="muted">(optional)</span>
              <input
                maxLength={300}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="policy, onboarding"
              />
            </label>
          </div>
          <p className="form-hint">
            Separate tags with commas. Scanned image-only PDFs may require OCR
            before upload.
          </p>
          {uploadMutation.isPending && (
            <div aria-live="polite">
              <div className="upload-progress">
                <span style={{ width: `${progress}%` }} />
              </div>
              <p className="form-hint">
                {progress < 100
                  ? `Uploading ${progress}%`
                  : 'Upload complete. Extracting and indexing…'}
              </p>
            </div>
          )}
          {uploadError && (
            <p role="alert" className="form-error">
              {uploadError}
            </p>
          )}
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={uploadMutation.isPending}
              onClick={() => setUpload(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!file || !category.trim() || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Spinner label="Indexing document" />
              ) : (
                <>
                  <Upload size={15} />
                  Upload & index
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={detail.data?.title || 'Document details'}
        description={
          detail.data?.filename ||
          'Inspect the extracted document and indexing details.'
        }
        wide
      >
        {detail.isPending ? (
          <Loading />
        ) : detail.isError ? (
          <ErrorState error={detail.error} retry={() => detail.refetch()} />
        ) : (
          detail.data && (
            <>
              <div className="detail-meta">
                <Status status={detail.data.status} />
                <Badge>{detail.data.category}</Badge>
                <span>{bytes(detail.data.size_bytes)}</span>
                <span>{detail.data.chunk_count} chunks</span>
              </div>
              <div className="tabs">
                {(['preview', 'chunks', 'details'] as const).map((t) => (
                  <button
                    className={tab === t ? 'active' : ''}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t === 'preview'
                      ? 'Extracted text'
                      : t === 'chunks'
                        ? 'Indexed chunks'
                        : 'File details'}
                  </button>
                ))}
              </div>
              <div className="modal-body document-detail-body">
                {detail.data.error && (
                  <p role="alert" className="form-error">
                    {detail.data.error}
                  </p>
                )}
                {tab === 'preview' ? (
                  <pre className="document-preview">
                    {detail.data.text ||
                      'No extracted text is available for this document.'}
                  </pre>
                ) : tab === 'chunks' ? (
                  detail.data.chunks?.length ? (
                    <div className="chunk-list">
                      {detail.data.chunks.map((chunk, index) => (
                        <div key={chunk.id}>
                          <Badge>Chunk {index + 1}</Badge>
                          {chunk.page && <span> · Page {chunk.page}</span>}
                          <p>{chunk.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title={`${detail.data.chunk_count} indexed chunks`}
                      description="Chunk-level passages are visible in research citations. This document endpoint does not expose individual chunks."
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelected(null);
                            navigate('/research');
                          }}
                        >
                          Research this knowledge
                        </Button>
                      }
                    />
                  )
                ) : (
                  <dl className="detail-list">
                    <dt>Filename</dt>
                    <dd>{detail.data.filename}</dd>
                    <dt>Document ID</dt>
                    <dd className="mono">{detail.data.id}</dd>
                    <dt>Added</dt>
                    <dd>{date(detail.data.created_at)}</dd>
                    <dt>Updated</dt>
                    <dd>
                      {detail.data.updated_at
                        ? date(detail.data.updated_at)
                        : 'Not reported'}
                    </dd>
                    <dt>Pages</dt>
                    <dd>{detail.data.page_count ?? 'Not reported'}</dd>
                    <dt>Tags</dt>
                    <dd>{detail.data.tags.join(', ') || 'No tags'}</dd>
                  </dl>
                )}
                {reindex.isError && (
                  <p role="alert" className="form-error">
                    {messageError(reindex.error)}
                  </p>
                )}
              </div>
              <div className="modal-actions detail-actions">
                <Button
                  variant="danger"
                  onClick={() => setDeleting(detail.data!)}
                >
                  <Trash2 size={14} />
                  Delete document
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    reindex.isPending || detail.data.status === 'indexing'
                  }
                  onClick={() => setReindexConfirm(true)}
                >
                  {reindex.isPending ? (
                    <Spinner label="Reindexing" />
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Reindex
                    </>
                  )}
                </Button>
              </div>
            </>
          )
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this document?"
        description="This removes the original document and its indexed chunks. Existing conversation citations may no longer open."
      >
        <div className="modal-body">
          <p>
            “{deleting?.title}” will be permanently removed from this workspace.
          </p>
          {deleteMutation.isError && (
            <p role="alert" className="form-error">
              {messageError(deleteMutation.error)}
            </p>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep document
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? (
                <Spinner label="Deleting" />
              ) : (
                'Delete document'
              )}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={reindexConfirm}
        onOpenChange={setReindexConfirm}
        title="Reindex this document?"
        description="The stored original will be processed again and its search passages replaced."
      >
        <div className="modal-body">
          <p>
            Reindex “{detail.data?.title}” using the current extraction and
            embedding configuration.
          </p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => setReindexConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selected) reindex.mutate(selected);
                setReindexConfirm(false);
              }}
            >
              Reindex document
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
function DatabaseIcon() {
  return <Folder size={24} />;
}
function ShieldIcon() {
  return <Layers size={21} />;
}
