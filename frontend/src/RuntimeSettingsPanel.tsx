import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Save, Settings2, ShieldCheck } from 'lucide-react';
import { api } from './api';
import {
  Badge,
  Button,
  ErrorState,
  Loading,
  SectionTitle,
} from './components/ui';

const providers = ['none', 'gemini', 'openai', 'ollama'] as const;
type Provider = (typeof providers)[number];
export type RuntimeSettings = {
  default_top_k: number;
  default_score_threshold: number;
  llm_provider: Provider;
  llm_model: string | null;
  allowed_providers: string[];
  configured_providers: Record<Provider, boolean>;
  embedding_model: string;
  embedding_dimension: number;
  status_note: string;
};
const modelPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/;
const fieldClass = 'w-full rounded-xl px-3 py-3 text-sm';
const labelClass = 'grid content-start gap-2 text-xs font-medium';
const helpClass = 'text-[var(--muted)] text-xs font-normal leading-relaxed';

export default function RuntimeSettingsPanel() {
  const query = useQuery({
    queryKey: ['runtime-settings'],
    queryFn: () => api<RuntimeSettings>('/admin/settings'),
  });
  return (
    <section className="panel settings-panel">
      <SectionTitle
        title="Server defaults"
        description="Persisted backend settings for the single-company instance."
        action={
          <span className="soft-icon">
            <Settings2 size={19} />
          </span>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && <SettingsForm settings={query.data} />
      )}
    </section>
  );
}

function SettingsForm({ settings }: { settings: RuntimeSettings }) {
  const cache = useQueryClient();
  const [topK, setTopK] = useState(String(settings.default_top_k));
  const [threshold, setThreshold] = useState(
    String(settings.default_score_threshold),
  );
  const [provider, setProvider] = useState<Provider>(settings.llm_provider);
  const [model, setModel] = useState(settings.llm_model ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const validRetrieval =
    topK.trim() !== '' &&
    Number.isInteger(Number(topK)) &&
    Number(topK) >= 1 &&
    Number(topK) <= 10 &&
    threshold.trim() !== '' &&
    Number.isFinite(Number(threshold)) &&
    Number(threshold) >= 0 &&
    Number(threshold) <= 1;
  const providerAllowed =
    settings.allowed_providers.includes(provider) &&
    !!settings.configured_providers[provider];
  const normalizedModel = model.trim();
  const validModel =
    normalizedModel.length <= 120 &&
    (provider === 'none'
      ? !normalizedModel || modelPattern.test(normalizedModel)
      : !!normalizedModel && modelPattern.test(normalizedModel));
  const valid = validRetrieval && providerAllowed && validModel;
  const availableProviders = providers.filter((value) =>
    settings.allowed_providers.includes(value),
  );
  function edit() {
    setSaved(false);
    setError('');
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          default_top_k: Number(topK),
          default_score_threshold: Number(threshold),
          llm_provider: provider,
          llm_model: normalizedModel,
        }),
      });
      // Re-read persisted state; do not treat a browser preference as a server change.
      await cache.invalidateQueries({ queryKey: ['runtime-settings'] });
      await cache.invalidateQueries({ queryKey: ['config'] });
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Server settings could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <Badge tone="purple">
          <ShieldCheck size={12} /> Server-managed
        </Badge>
        <span>
          These defaults apply when a permitted request does not supply an
          override.
        </span>
      </div>
      <div className="grid max-w-3xl gap-5 md:grid-cols-2">
        <label className={labelClass} htmlFor="server-top-k">
          Server maximum source passages
          <input
            id="server-top-k"
            aria-label="Server maximum source passages"
            className={fieldClass}
            type="number"
            min={1}
            max={10}
            step={1}
            required
            value={topK}
            disabled={busy}
            onChange={(e) => {
              setTopK(e.target.value);
              edit();
            }}
          />
          <small className={helpClass}>
            A whole number from 1 to 10. These are retrieved passages, not
            generated claims.
          </small>
        </label>
        <label className={labelClass} htmlFor="server-threshold">
          Server minimum relevance score
          <input
            id="server-threshold"
            aria-label="Server minimum relevance score"
            className={fieldClass}
            type="number"
            min={0}
            max={1}
            step="any"
            required
            value={threshold}
            disabled={busy}
            onChange={(e) => {
              setThreshold(e.target.value);
              edit();
            }}
          />
          <small className={helpClass}>
            0–1 similarity threshold. A similarity score is not a truth
            probability.
          </small>
        </label>
        <label className={labelClass} htmlFor="server-provider">
          Generation provider
          <select
            id="server-provider"
            aria-label="Generation provider"
            className={fieldClass}
            value={provider}
            disabled={busy}
            onChange={(e) => {
              setProvider(e.target.value as Provider);
              edit();
            }}
          >
            {!availableProviders.includes(provider) && (
              <option value={provider} disabled>
                {provider} — not permitted
              </option>
            )}
            {availableProviders.map((value) => (
              <option
                value={value}
                key={value}
                disabled={!settings.configured_providers[value]}
              >
                {value === 'none'
                  ? 'None · retrieval only'
                  : `${value}${settings.configured_providers[value] ? '' : ' · server configuration required'}`}
              </option>
            ))}
          </select>
          <small className={helpClass}>
            Only server-permitted providers can be selected. Unconfigured
            providers are disabled.
          </small>
        </label>
        <label className={labelClass} htmlFor="server-model">
          Generation model
          <input
            id="server-model"
            aria-label="Generation model"
            className={fieldClass}
            maxLength={120}
            value={model}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              provider === 'none'
                ? 'Optional while retrieval-only'
                : 'A model available to your provider account'
            }
            onChange={(e) => {
              setModel(e.target.value);
              edit();
            }}
          />
          <small className={helpClass}>
            A model identifier only: letters, numbers, dots, underscores,
            colons, slashes and hyphens. Maximum 120 characters.
          </small>
        </label>
      </div>
      {!validRetrieval && (
        <p className="form-error" role="alert">
          Use 1–10 whole passages and a relevance threshold between 0 and 1.
        </p>
      )}
      {!validModel && (
        <p className="form-error" role="alert">
          Enter a valid model identifier of up to 120 characters. A model is
          required for generation.
        </p>
      )}
      {!providerAllowed && (
        <p className="form-error" role="alert">
          This provider is unavailable. Configure its credentials and permit it
          on the server before selecting it.
        </p>
      )}
      <div className="inline-info mt-6">
        <strong>Credentials stay on the server.</strong> Configure provider
        credentials through the local server environment or a secret manager.
        This page never requests or displays API keys. Gemini remains
        unavailable until its server configuration is ready. Selecting a
        configured provider does not prove model access or quota availability.
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        {settings.status_note ||
          'Configuration status only; live access/quotas require real request'}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        Embedding: {settings.embedding_model} · {settings.embedding_dimension}{' '}
        dimensions. Changing generation settings does not change the embedding
        model or make French retrieval reliable.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-save">
        <p>
          {saved ? (
            <span role="status">Server defaults saved.</span>
          ) : (
            'Changes are stored by the backend. Browser Playground overrides remain separate.'
          )}
        </p>
        <Button disabled={!valid || busy} type="submit">
          {saved ? <Check size={15} /> : <Save size={15} />}{' '}
          {busy ? 'Saving server defaults…' : 'Save server defaults'}
        </Button>
      </div>
    </form>
  );
}
