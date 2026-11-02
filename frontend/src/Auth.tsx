import { AuthContext } from './auth-context';
import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { LockKeyhole, ArrowRight, ShieldCheck } from 'lucide-react';
import { api, setCsrfToken } from './api';
import './auth.css';

type Admin = { id: string; username: string; csrf_token: string };
export function AuthGate({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cache = useQueryClient();
  const location = useLocation();
  useEffect(() => {
    let live = true;
    const expire = () => {
      setCsrfToken('');
      setAdmin(null);
      cache.clear();
    };
    window.addEventListener('knowledgeos-session-expired', expire);
    void api<Admin>('/auth/me')
      .then((value) => {
        if (live) {
          setCsrfToken(value.csrf_token);
          setAdmin(value);
        }
      })
      .catch(() => {
        if (live) expire();
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      window.removeEventListener('knowledgeos-session-expired', expire);
    };
  }, [cache]);
  async function login(username: string, password: string) {
    const value = await api<Admin>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    cache.clear();
    setCsrfToken(value.csrf_token);
    setAdmin(value);
    setError('');
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setCsrfToken('');
      setAdmin(null);
      cache.clear();
      setError('');
    } catch {
      setError('Sign out failed. Please try again.');
    }
  }
  if (loading)
    return (
      <div className="auth-loading" role="status">
        Checking administrator session…
      </div>
    );
  if (!admin) {
    if (location.pathname !== '/login')
      return (
        <Navigate to="/login" replace state={{ from: location.pathname }} />
      );
    return <Login onLogin={login} />;
  }
  if (location.pathname === '/login') {
    const from = (location.state as { from?: string } | null)?.from;
    return (
      <Navigate
        to={
          from?.startsWith('/') && !from.startsWith('//') && from !== '/login'
            ? from
            : '/'
        }
        replace
      />
    );
  }
  return (
    <AuthContext.Provider value={{ logout }}>
      {error && (
        <div className="auth-session-error" role="alert">
          {error}
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}
function Login({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      await onLogin(username, password);
      setPassword('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Sign in unavailable. Please try again.',
      );
      setPassword('');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <img src="/iaweb-logo.svg" alt="IAWEB" width="180" />
        <span className="auth-eyebrow">KNOWLEDGEOS · ADMINISTRATION</span>
        <h1>
          Your knowledge.
          <br />
          <span>In trusted hands.</span>
        </h1>
        <p>
          Manage your documents, inspect the evidence, and keep your knowledge
          workspace connected.
        </p>
        <div>
          <ShieldCheck size={19} /> Administrator access
        </div>
        <small>
          Synthetic portfolio reconstruction · Independent demonstration
        </small>
      </section>
      <section className="auth-card">
        <span className="auth-lock">
          <LockKeyhole size={25} />
        </span>
        <h2>Welcome back.</h2>
        <p>Sign in to your KnowledgeOS workspace.</p>
        <form onSubmit={submit}>
          <label htmlFor="admin-username">Username</label>
          <input
            id="admin-username"
            autoComplete="username"
            required
            maxLength={160}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-help">
          First access? Create an administrator from the server terminal using
          the setup guide.
        </p>
      </section>
    </main>
  );
}
