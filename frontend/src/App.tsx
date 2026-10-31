import { lazy, Suspense, useEffect, useState } from 'react';
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  Command,
  Database,
  HelpCircle,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  Network,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { api, type Config, type Health } from './api';
import { Badge, Button, Crumb, Loading, Modal } from './components/ui';
import FloatingAssistant from './components/FloatingAssistant';
const Overview = lazy(() => import('./Overview'));
const Documents = lazy(() => import('./Documents'));
const Research = lazy(() => import('./Research'));
const AnalyticsPage = lazy(() =>
  import('./OtherPages').then((module) => ({ default: module.AnalyticsPage })),
);
const Architecture = lazy(() =>
  import('./OtherPages').then((module) => ({ default: module.Architecture })),
);
const SettingsPage = lazy(() =>
  import('./OtherPages').then((module) => ({ default: module.SettingsPage })),
);
const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/research', label: 'Research', icon: MessageSquare },
  { to: '/documents', label: 'Knowledge Base', icon: Database },
  { to: '/analytics', label: 'Intelligence', icon: ChartNoAxesCombined },
];
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState(false);
  const [term, setTerm] = useState('');
  const [dark, setDark] = useState(
    () => localStorage.getItem('knowledgeos-theme') === 'dark',
  );
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<Config>('/config'),
  });
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<Health>('/health'),
    refetchInterval: 30000,
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('knowledgeos-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  const current =
    [
      ...navigation,
      { to: '/architecture', label: 'Architecture' },
      { to: '/settings', label: 'Settings' },
    ].find((i) => i.to === location.pathname)?.label || 'Page not found';
  const configured =
    config.data?.llm_provider && config.data.llm_provider !== 'none';
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <NavLink
          to="/"
          className="brand"
          aria-label="IAWEB · KnowledgeOS overview"
        >
          <img src="/iaweb-logo.svg" width="180" height="46" alt="IAWEB" />
          <span className="brand-product">
            KnowledgeOS <span>PORTFOLIO DEMO</span>
          </span>
        </NavLink>
        <button
          className="workspace-switch"
          onClick={() => navigate('/settings')}
        >
          <span className="workspace-avatar">K</span>
          <span>
            Knowledge workspace<small>Synthetic company data</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              end={item.to === '/'}
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={18} />
              {item.label}
              {item.to === '/research' && (
                <span className="nav-shortcut">↗</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="nav-caption system-caption">SYSTEM</div>
        <nav aria-label="System navigation">
          <NavLink to="/architecture" className="nav-item">
            <Network size={18} />
            Architecture
          </NavLink>
          <NavLink to="/settings" className="nav-item">
            <Settings size={18} />
            Settings
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-status">
            <span className={`status-dot ${health.isError ? 'offline' : ''}`} />
            <span>
              {health.isSuccess
                ? 'System connected'
                : health.isError
                  ? 'Connection unavailable'
                  : 'Connecting to system'}
              <small>
                {configured
                  ? 'Language model configured'
                  : 'Local retrieval · no LLM provider'}
              </small>
            </span>
            <Activity size={15} />
          </div>
          <button className="help-link" onClick={() => setHelp(true)}>
            <HelpCircle size={17} />
            Workspace guide
            <ArrowUpRight size={14} />
          </button>
          <div className="profile">
            <span className="profile-avatar">DE</span>
            <span>
              Demo explorer<small>Portfolio workspace</small>
            </span>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </button>
          <NavLink
            to="/"
            className="mobile-brand"
            aria-label="IAWEB · KnowledgeOS overview"
          >
            <img src="/iaweb-logo.svg" width="112" height="29" alt="IAWEB" />
          </NavLink>
          <Crumb label={current} />
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearch(true)}>
              <Search size={15} />
              <span>Find your way</span>
              <kbd>⌘ K</kbd>
            </button>
            <Badge tone="purple">Demo workspace</Badge>
            <button
              className="icon-button"
              aria-label={
                dark ? 'Switch to light theme' : 'Switch to dark theme'
              }
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="topbar-avatar">DE</span>
          </div>
        </header>
        <div className="demo-notice">
          <span>
            <span className="notice-dot" />
            Synthetic portfolio reconstruction
          </span>
          <span>
            Sample company data ·{' '}
            {config.isError
              ? 'configuration unavailable'
              : configured
                ? 'AI answers use a configured provider'
                : 'retrieval-only mode, no AI generation'}
          </span>
          <button aria-label="About this demo" onClick={() => setHelp(true)}>
            <ArrowUpRight size={13} />
          </button>
        </div>
        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/research" element={<Research />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/architecture" element={<Architecture />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route
                    path="*"
                    element={
                      <div className="empty-state">
                        <h1>Page not found</h1>
                        <p>This page isn’t part of the workspace.</p>
                        <Button onClick={() => navigate('/')}>
                          Back to overview
                        </Button>
                      </div>
                    }
                  />
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
        <footer>
          <span>
            KnowledgeOS <span className="footer-dot">·</span> From information
            to understanding.
          </span>
          <span>
            <span className="status-dot" />
            Local-first workspace <span className="footer-dot">·</span>{' '}
            Synthetic demo
          </span>
        </footer>
      </div>
      <FloatingAssistant />
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="A clearer path to knowledge"
        description="Your guide to this portfolio workspace"
      >
        <div className="modal-body guide">
          <p>
            KnowledgeOS is a synthetic enterprise RAG portfolio reconstruction.
            The company policies, documents, and employee identities are
            fictional. The IAWEB.DEV logo is a visual reference; this is an
            independent demo, not an official IAWEB.DEV application. Counts,
            searches, citations, and system status come from the running
            application.
          </p>
          <div>
            <Database size={20} />
            <p>
              <strong>Build your knowledge base</strong>
              <br />
              Upload supported documents, add categories, and inspect the
              extracted text.
            </p>
          </div>
          <div>
            <MessageSquare size={20} />
            <p>
              <strong>Research with evidence</strong>
              <br />
              Ask a question and inspect matching passages, relevance, and
              retrieval timing. Without an LLM, answers contain retrieved
              excerpts only.
            </p>
          </div>
          <div>
            <Network size={20} />
            <p>
              <strong>See how it works</strong>
              <br />
              Architecture and Settings explain the actual pipeline and runtime
              configuration.
            </p>
          </div>
          <Button
            onClick={() => {
              setHelp(false);
              navigate('/documents');
            }}
          >
            Explore knowledge base
            <ArrowUpRight size={15} />
          </Button>
        </div>
      </Modal>
      <Modal
        open={search}
        onOpenChange={setSearch}
        title="Go to workspace"
        description="Search pages or start a research question"
      >
        <div className="modal-body">
          <div className="search-field">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search workspace pages"
              placeholder="Search a page or ask a question…"
              maxLength={2000}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <div className="command-results">
            {[
              ...navigation,
              { to: '/architecture', label: 'Architecture', icon: Network },
              { to: '/settings', label: 'Settings', icon: Settings },
            ]
              .filter((i) => i.label.toLowerCase().includes(term.toLowerCase()))
              .map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    navigate(item.to);
                    setSearch(false);
                    setTerm('');
                  }}
                >
                  <item.icon size={18} />
                  {item.label}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            {term && (
              <button
                onClick={() => {
                  navigate('/research', { state: { question: term } });
                  setSearch(false);
                  setTerm('');
                }}
              >
                <Plus size={18} />
                Research “{term}”<Command size={14} />
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
