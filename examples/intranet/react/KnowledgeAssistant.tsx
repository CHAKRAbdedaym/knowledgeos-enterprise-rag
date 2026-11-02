import { useEffect, useRef, useState } from 'react';

type EmployeeToken = {
  access_token: string;
  expires_at?: string;
  expires_in?: number;
};
type WidgetInstance = HTMLElement & { toggle(open: boolean): Promise<void> };
type WidgetModule = {
  mountKnowledgeOS(options: {
    apiUrl: string;
    title: string;
    accent: string;
    logo?: string;
    container: HTMLElement;
    getToken: () => Promise<EmployeeToken>;
  }): WidgetInstance;
};

/** Mount only after the portal has authenticated its employee. No permanent key. */
export function KnowledgeAssistant({
  apiUrl,
  moduleUrl = '/widget/knowledgeos-widget.js',
  title = 'Company knowledge assistant',
  accent = '#2458ff',
  logo,
  getToken,
}: {
  apiUrl: string;
  moduleUrl?: string;
  title?: string;
  accent?: string;
  logo?: string;
  getToken: () => Promise<EmployeeToken>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const acquire = useRef(getToken);
  useEffect(() => {
    acquire.current = getToken;
  }, [getToken]);
  useEffect(() => {
    let disposed = false;
    let widget: WidgetInstance | undefined;
    void (async () => {
      try {
        const module = (await import(
          /* @vite-ignore */ moduleUrl
        )) as WidgetModule;
        if (!disposed && container.current) {
          widget = module.mountKnowledgeOS({
            apiUrl,
            title,
            accent,
            logo,
            container: container.current,
            getToken: () => acquire.current(),
          });
          setError('');
        }
      } catch {
        if (!disposed)
          setError(
            'The knowledge assistant could not be loaded. Please reload this page.',
          );
      }
    })();
    return () => {
      disposed = true;
      widget?.remove();
    };
  }, [apiUrl, moduleUrl, title, accent, logo]);
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <div ref={container} />
    </>
  );
}

// Example inside an authenticated portal component:
// <KnowledgeAssistant key={employee.subject} apiUrl="https://knowledge.example/api/v1"
//   getToken={() => fetch('/portal/widget-session', {
//     method: 'POST', credentials: 'same-origin',
//     headers: {'Content-Type': 'application/json', 'X-CSRF-Token': portalCsrf},
//     body: '{}',
//   }).then(async response => {
//     if (!response.ok) throw new Error('Employee sign-in is required.');
//     return response.json();
//   })} />
// Changing employee identity must unmount the old component (the key does so).
