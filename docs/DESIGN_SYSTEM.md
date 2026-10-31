# KnowledgeOS design system

## Product structure

The primary task is finding inspectable evidence in a small knowledge base. Overview introduces the workspace and its real counts. Research connects a question to a conversation and sources. Knowledge Base manages the actual indexed documents. Intelligence reports observed usage. Architecture and Settings explain implementation and current configuration.

The shared shell uses a white sidebar with the public IAWEB.DEV wordmark, electric-blue active navigation, a white topbar, a persistent synthetic-demo notice and a pale blue work surface. The KnowledgeOS product label remains underneath the wordmark. Mobile navigation becomes a dismissible drawer, with the wordmark visible in the mobile topbar. A command dialog provides keyboard navigation between sections. Source and document inspection use focus-managed dialogs rather than a separate hidden application. The application-wide visual layer lives in `frontend/src/brand.css`.

## Tokens

| Token | Light value | Purpose |
|---|---|---|
| Canvas | `#f5f7fc` | Main work surface |
| Panel | `#ffffff` | Tables, cards, dialogs |
| Sidebar | `#ffffff` | Navigation and wordmark |
| Text | `#343d53` | Primary content |
| Heading | `#151d38` | Navy titles and hierarchy |
| Muted | `#626c82` | Secondary readable copy |
| Border | `#e1e7f1` | Quiet separation |
| Accent (legacy `--indigo` token) | `#2458ff` | Research actions, selection and focus |
| Soft accent | `#eaf0ff` | Notices and icon backing |

Dark mode swaps canvas, panels, text, borders and accent variables; it is persisted in browser preferences. Colors carry meaning alongside text/icons, not alone. Charts use a coordinated muted category palette and tooltips with exact stored counts.

Inter body text and Space Grotesk headings are self-hosted through Fontsource, avoiding runtime font-CDN requests. Headings use bold weight and tight tracking, with a larger blue/navy dashboard hero. Body text is about 14px, navigation about 13px, and most supporting copy at least 11px. Decorative brand lettering is smaller; it is not the only accessible product label.

Spacing follows an approximately 4px rhythm: small control gaps, 16–24px panel spacing and about 32px desktop work-area padding. Borders are generally 1px; primary cards use 16px corners, the hero uses 24px, and action buttons/navigation use pill shapes. Shadows are subtle and communicate elevation.

## Reusable patterns

`frontend/src/components/ui.tsx` contains Button, Badge, Spinner, Loading, ErrorState, Empty, Modal, PageHeading, SectionTitle and Status. The locally owned shadcn/ui Button and Dialog components use Radix primitives, class-variance-authority, class merging and native semantic controls; their MIT attribution is retained. Components remain local and inspectable instead of depending on a generated theme package.

- Page headings pair a meaningful title with the principal action.
- Tables and grids share the same document records and filtering state.
- Pending cards use skeletons; destructive actions use explicit dialogs.
- Upload byte progress transitions into a truthful extraction/indexing message.
- Provider mode labels distinguish configured generation, retrieved excerpts and abstention.
- Source cards show actual passage text and similarity, with a warning that similarity is not correctness probability.
- Analytics without events displays an honest empty state.

## Accessibility and motion

Radix handles dialog focus trapping and Escape dismissal. Inputs and icon buttons have accessible names. Keyboard focus has a visible outline. Tables use semantic headers. Error messages use alert roles, and asynchronous upload status is announced. Markdown rendering disables raw HTML. Motion is brief and honors reduced-motion preferences where configured.

Responsive verification should include 1440px desktop, 768px tablet and 390px mobile. Tables can scroll within their panels, while the document itself must not overflow horizontally. Touch targets and dense secondary copy still deserve a dedicated assistive-technology review before a production release; no WCAG certification is claimed.

## Visual evidence

Screenshots under `docs/screenshots/` are captured from the actual running UI. They are not fabricated mockups. Their counts reflect seeding and real demonstration/test requests at capture time. See TESTING.md for the executed viewport checks and remaining accessibility coverage gaps.

## Floating assistant visual reference

The floating chat shares the application’s visual reference from [IAWEB.DEV](https://iaweb.dev/): electric blue `#2458FF`, ink navy `#151D38`, white surfaces, Space Grotesk headings and pill-shaped controls. Its navy header retains the KnowledgeOS identity and the synthetic-demo notice. Dark mode uses light blue accents and navy surfaces; the original logo is displayed on a white backing for legibility. Space Grotesk is self-hosted through Fontsource under OFL-1.1. Logo provenance is documented in [third-party notices](../THIRD_PARTY_NOTICES.md); this is not IAWEB.DEV’s official customer service.

The chat header displays the full IAWEB wordmark. The browser tab, floating launcher and Research assistant avatars use a compact symbol extracted from the same SVG, preserving its geometry and colors. A white rounded backing keeps the navy symbol legible in both themes. The launcher retains its accessible open/close label and switches to a close icon while the panel is open.
