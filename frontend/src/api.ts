export interface Document {
  id: string;
  title: string;
  filename: string;
  category: string;
  tags: string[];
  status: string;
  chunk_count: number;
  page_count?: number | null;
  size_bytes: number;
  created_at: string;
  updated_at?: string;
  error?: string | null;
  text?: string;
  chunks?: { id: string; text: string; page?: number }[];
}
export interface Source {
  document_id: string;
  title: string;
  chunk_id: string;
  text: string;
  score: number;
  page: number | null;
  start_offset: number;
  end_offset: number;
}
export interface Trace {
  question?: string;
  latency_ms: number;
  retrieval_ms: number;
  provider: string;
  model: string | null;
  top_k: number;
  score_threshold: number;
  matched_chunks: number;
  embedding_model: string;
}
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: 'retrieval_only' | 'grounded' | 'abstained' | null;
  sources: Source[];
  trace: Trace | null;
  created_at: string;
}
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  messages?: Message[];
}
export interface Trend {
  date: string;
  count: number;
}
export interface Dashboard {
  documents: number;
  chunks: number;
  conversations: number;
  queries: number;
  categories: { name: string; count: number }[];
  query_trend: Trend[];
  recent_documents: Document[];
  recent_activity: {
    id?: string;
    type?: string;
    title?: string;
    description?: string;
    created_at?: string;
  }[];
}
export interface Analytics {
  queries: number;
  average_latency_ms: number;
  average_chunks: number;
  query_trend: Trend[];
  most_referenced: { id: string; title: string; count: number }[];
  categories: { name: string; count: number }[];
}
export interface Config {
  llm_provider: string;
  llm_model: string;
  embedding_model: string;
  embedding_dimension: number;
  embedding_revision: string;
  collection: string;
  max_upload_mb: number;
  chunk_size: number;
  chunk_overlap: number;
  default_top_k: number;
  default_score_threshold: number;
}
export interface Health {
  status: string;
  [key: string]: unknown;
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      detail =
        typeof body.detail === 'string' ? body.detail : body.message || detail;
    } catch {
      /* Non-JSON server errors retain HTTP status. */
    }
    throw new Error(detail);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function uploadDocument(
  file: File,
  category: string,
  tags: string,
  onProgress: (n: number) => void,
): Promise<Document> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/documents');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else
          reject(
            new Error(
              typeof body.detail === 'string' ? body.detail : 'Upload failed',
            ),
          );
      } catch {
        reject(new Error('Unexpected upload response'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload connection failed'));
    const data = new FormData();
    data.append('file', file);
    data.append('category', category);
    data.append('tags', tags);
    xhr.send(data);
  });
}
export function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? '—'
    : parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}
export function bytes(value: number) {
  return value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MB`
    : `${Math.round(value / 1024)} KB`;
}
export const messageError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
