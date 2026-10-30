# KnowledgeOS design system

## Product structure

The primary task is finding inspectable evidence in a small knowledge base. Overview introduces the workspace and its real counts. Research connects a question to a conversation and sources. Knowledge Base manages the actual indexed documents. Intelligence reports observed usage. Architecture and Settings explain implementation and current configuration.

The shared shell uses a fixed graphite sidebar on desktop, a quiet white topbar, a persistent synthetic-demo notice and a lightly tinted work surface. Mobile navigation becomes a dismissible drawer. A command dialog provides keyboard navigation between sections. Source and document inspection use focus-managed dialogs rather than a separate hidden application.

## Tokens

| Token | Light value | Purpose |
|---|---|---|
| Canvas | `#f7f8fa` | Main work surface |
| Panel | `#ffffff` | Tables, cards, dialogs |
| Sidebar | `#1d202c` | Stable navigation anchor |
| Text | `#303342` | Primary content |
| Heading | `#242735` | Titles and hierarchy |
| Muted | `#687184` | Secondary readable copy |
| Border | `#e9eaf0` | Quiet separation |
| Indigo | `#6965db` | Research actions and focus |
| Soft indigo | `#f0effd` | Selected state and icon backing |

Dark mode swaps canvas, panels, text, borders and accent variables; it is persisted in browser preferences. Colors carry meaning alongside text/icons, not alone. Charts use a coordinated muted category palette and tooltips with exact stored counts.

Inter is self-hosted through a legitimate Fontsource package, avoiding runtime font-CDN requests. Headings use restrained weight and tight tracking. Body text is about 14px, navigation about 13px, and most supporting copy at least 11px. Decorative brand lettering is smaller; it is not the only accessible product label.

Spacing follows an approximately 4px rhythm: small control gaps, 16–24px panel spacing and about 32px desktop work-area padding. Borders are generally 1px; corners are 6–10px, with larger rounded illustration forms only in the research hero. Shadows are subtle and communicate elevation rather than decorate every surface.

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
