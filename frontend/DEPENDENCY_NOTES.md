# Dependency review

Runtime package versions and licenses verified against official npm registry metadata on 2026-10-30. Exact transitive resolutions and integrity hashes are retained in package-lock.json. Inter is bundled locally; its font license is SIL Open Font License 1.1. No remote font service is used.

| Package                  | Installed version | Registry license |
| ------------------------ | ----------------- | ---------------- |
| @fontsource/inter        | 5.3.0             | OFL-1.1          |
| @radix-ui/react-dialog   | 1.3.1             | MIT              |
| @radix-ui/react-slot     | 1.5.0             | MIT              |
| @radix-ui/react-tooltip  | 1.4.1             | MIT              |
| @tanstack/react-query    | 5.105.0           | MIT              |
| class-variance-authority | 0.7.1             | Apache-2.0       |
| clsx                     | 2.1.1             | MIT              |
| lucide-react             | 0.468.0           | ISC              |
| motion                   | 12.43.0           | MIT              |
| react                    | 19.3.1            | MIT              |
| react-dom                | 19.3.1            | MIT              |
| react-markdown           | 10.1.0            | MIT              |
| react-router-dom         | 7.18.5            | MIT              |
| recharts                 | 3.10.1            | MIT              |
| tailwind-merge           | 3.7.0             | MIT              |

Node 22 is used in the frontend container. Local development should use Node 22.13 or later because current lint tooling dependencies require it.

The locally owned Button and Dialog components adapt the shadcn/ui New York registry source to KnowledgeOS design tokens. Their upstream MIT copyright and license are preserved in [SHADCN_LICENSE.txt](SHADCN_LICENSE.txt). `components.json`, the TypeScript path mapping, and the Vite alias support adding further components consistently.

Vitest 4.1.12 resolves the mocker and tinypool advisories present in the earlier test runner. `npm audit` reports no known vulnerabilities for the resolved dependency tree as of 2026-10-30.
