import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { Badge, ErrorState, Loading, SectionTitle } from './components/ui';
type Activity = {
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
};
export default function EnterpriseActivity({
  days = 7,
  detailed = false,
}: {
  days?: number;
  detailed?: boolean;
}) {
  const query = useQuery({
    queryKey: ['enterprise-activity', days],
    queryFn: () => api<Activity>(`/admin/analytics?days=${days}`),
  });
  const data = query.data;
  return (
    <section className="panel my-6" aria-label="Enterprise activity">
      <SectionTitle
        title="Enterprise activity"
        description={`Persisted activity over ${days} days. Employee questions are redacted.`}
        action={<Badge>Server records</Badge>}
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        data && (
          <>
            <div className="grid grid-cols-2 gap-4 py-5 lg:grid-cols-4">
              {[
                ['Active integrations', data.integrations_active],
                ['No retrieved evidence', data.no_result_count],
                ['Abstentions', data.abstention_count],
                ['Provider errors', data.provider_error_count],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-[var(--muted)]">{label}</p>
                  <strong className="text-2xl">{value}</strong>
                </div>
              ))}
            </div>
            {detailed && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-semibold">
                    Requests by integration
                  </h3>
                  {data.queries_by_integration.length ? (
                    data.queries_by_integration.map((i) => (
                      <div
                        key={i.id}
                        className="flex justify-between gap-3 border-b border-[var(--border)] py-2 text-sm"
                      >
                        <span className="break-words">{i.name}</span>
                        <strong>{i.count}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      No integrations configured.
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold">
                    Recent request outcomes
                  </h3>
                  {data.recent_events.length ? (
                    <ul className="grid gap-2">
                      {data.recent_events.slice(0, 8).map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-2 text-xs"
                        >
                          <span>
                            {e.channel} · {e.mode}
                          </span>
                          <span>
                            {e.latency_ms} ms ·{' '}
                            {new Date(e.created_at).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      No requests recorded in this period.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
