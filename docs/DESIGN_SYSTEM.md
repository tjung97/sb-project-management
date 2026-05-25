# Seoul Bowl Ops — Design System

**Version:** 1.0  
**Last updated:** 2026-05-23  
**Status:** Active (internal product)  
**Audience:** Product, engineering, operations leads  
**Stack:** Next.js · React · Tailwind CSS v4 · shadcn-style primitives · Radix UI

---

## Table of contents

1. [Purpose](#1-purpose)
2. [Design principles](#2-design-principles)
3. [Foundations](#3-foundations)
4. [Layout & navigation](#4-layout--navigation)
5. [Components](#5-components)
6. [Patterns](#6-patterns)
7. [Content & voice](#7-content--voice)
8. [Motion & feedback](#8-motion--feedback)
9. [Accessibility](#9-accessibility)
10. [Implementation guide](#10-implementation-guide)
11. [Quality checklist](#11-quality-checklist)
12. [Roadmap](#12-roadmap)

---

## 1. Purpose

Seoul Bowl Ops is an **internal operations console** for a multi-location restaurant business. It is not a generic project-management SaaS. Users are store managers, warehouse staff, HQ, and admins working under time pressure on desktop and phone.

The design system exists to make work **scannable, accountable, and calm**:

- **Scannable** — status, owner, location, and urgency are visible without opening every item.
- **Accountable** — people changes and updates read like an audit trail (Git-inspired clarity).
- **Calm** — strong hierarchy, restrained decoration, no duplicate metrics or noisy chrome.

### Product metaphors

| Metaphor | UI expression |
|----------|----------------|
| **Issue** | Unit of follow-up (repair, vendor, supply, task) |
| **Project** | Multi-day initiative spanning stores or teams |
| **Activity** | Immutable timeline of who changed what |
| **Location** | Store, warehouse, HQ — color-coded, never ambiguous |
| **Queue** | Primary list surfaces (`/issues`, inbox, dashboards) |

### Out of scope (for now)

- Marketing/landing aesthetics
- Heavy data visualization / BI dashboards
- Playful illustration-heavy empty states
- Full dark-mode token audit (foundation exists; polish ongoing)

---

## 2. Design principles

### 2.1 Operations first

Every screen answers: **What needs attention? Who owns it? What happened last?**

Prefer dense, legible lists over large hero marketing blocks. Default views show **open work**, not all history.

### 2.2 One source of truth per fact

Do not repeat the same metric or filter in multiple places on one page (e.g. open count in KPI cards, badge links, and list header). Pick one primary surface; others link to it.

### 2.3 Semantic color, not decoration

Color encodes **meaning**: status, priority, role, location kind. Avoid using color only for branding. When in doubt, use neutral surfaces and typography.

### 2.4 Sturdy, not soft

Corners are **moderately rounded** (`rounded-md` / `rounded-lg`), not pill-shaped everywhere. The product should feel like reliable infrastructure, not a consumer social app.

### 2.5 Server truth, client polish

Data is authoritative on the server. Client components handle navigation state, density, filters, and transitions — never pass non-serializable props (e.g. icon components) from Server to Client Components.

### 2.6 Progressive disclosure

Show status + title + owner in the list. Description, checklist, sub-issues, and full activity belong on the detail page or collapsed panels.

---

## 3. Foundations

### 3.1 Color

Tokens live in `app/globals.css` as HSL CSS variables. Use Tailwind semantic classes (`bg-primary`, `text-muted-foreground`), not raw hex in components.

#### Core UI tokens

| Token | Role | Usage |
|-------|------|--------|
| `background` | App canvas | Page background |
| `foreground` | Primary text | Titles, body |
| `card` | Elevated surface | Cards, header |
| `muted` / `muted-foreground` | Secondary | Meta, placeholders, descriptions |
| `primary` | Primary actions | Submit, active nav (dark neutral) |
| `secondary` | Subtle fills | Chips, inactive toggles |
| `accent` | Highlight | Quick-jump banners, hover washes |
| `destructive` | Danger / blocked | Errors, blocked status |
| `border` / `input` | Structure | Borders, form fields |

#### Semantic status tokens

| Token | Meaning |
|-------|---------|
| `success` | Done, completed, positive KPI |
| `warning` | High priority, due soon, caution |
| `info` | In progress, informational |
| `destructive` | Blocked, overdue, urgent |

#### Domain tokens (roles & locations)

Defined in `src/lib/ops/semantic.ts`:

| Category | Values | Usage |
|----------|--------|--------|
| **Role** | `admin`, `manager`, `member` | `RoleBadge`, permissions context |
| **Location kind** | `store`, `warehouse`, `hq`, `office`, `global` | `LocationKindBadge`, list row left border |

**Rule:** Never invent ad-hoc colors for roles or locations. Extend `semantic.ts` and CSS variables together.

#### Color usage rules

1. **Primary CTA** — use `Button` variant `default` (primary). Reserve `success` green for *completed* states, not every “create” action (avoid confusion with “Done”).
2. **List risk** — blocked rows may use `bg-destructive/5`; overdue may use `bg-warning/5`. Do not rely on color alone (pair with badge + text).
3. **Contrast** — body text on `background` and `card` must meet WCAG AA (4.5:1). Muted text is for secondary info only, never sole indicator of state.

---

### 3.2 Typography

#### Font families

| Family | Variable | Use |
|--------|----------|-----|
| **Geist Sans** | `--font-geist-sans` | UI, titles, body |
| **Geist Mono** | `--font-geist-mono` | Issue numbers (`#42`), codes, optional dates |

Configured in `app/layout.tsx`.

#### Type scale

| Name | Classes | Use |
|------|---------|-----|
| **Display** | `text-3xl font-semibold tracking-tight` | Page title (once per page) |
| **Title** | `text-lg font-semibold` | Card titles |
| **Body** | `text-sm` | Default UI copy, list meta |
| **Body emphasis** | `text-sm font-medium` | Names, emphasized meta |
| **Caption** | `text-xs text-muted-foreground` | Timestamps, helper text |
| **Micro label** | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | Section labels (use consistently or not at all) |

#### Typography rules

1. **One H1 per page** — e.g. “Issues”, “Inbox”, “Reports”.
2. **Issue titles in lists** — `text-base font-medium`; issue number `font-mono text-xs text-muted-foreground`.
3. **Tabular numbers** — apply `tabular-nums` to KPI values and aligned numeric columns.
4. **Sentence case** — prefer “Work queue” over “WORK QUEUE” except defined micro-labels.
5. **Line length** — descriptions `max-w-2xl` or `line-clamp-2` in lists.

---

### 3.3 Spacing & radius

#### Spacing scale (8px base)

| Token | Value | Use |
|-------|-------|-----|
| `1` | 4px | Tight icon gaps |
| `2` | 8px | Chip gaps, inline groups |
| `3` | 12px | Form field gaps |
| `4` | 16px | Compact card padding |
| `5` | 20px | Standard card padding (`p-5`) |
| `6` | 24px | Section spacing, list card headers (`sm:p-6`) |

**Page sections:** `space-y-6` between major blocks on queue pages (`/issues`). Use `space-y-5` on denser dashboards.

**List cards:** Use `CardListHeader` + `CardListBody` from `src/components/ui/card.tsx` when the body is flush divided rows. The header includes `py-4 sm:py-5` bottom padding before the border — do not use plain `CardHeader` with `pb-0` for list surfaces.

#### Border radius

Global `--radius: 0.5rem` (8px).

| Class | Use |
|-------|-----|
| `rounded-sm` | Select items, small chips |
| `rounded-md` | Buttons, inputs, badges, nav items |
| `rounded-lg` | Cards, panels, filter bars |
| `rounded-full` | **Avatars and status dots only** — not buttons or cards |

**Do not mix** `rounded-xl` / `rounded-2xl` on standard cards unless documenting an exception.

#### Elevation

| Token | Use |
|-------|-----|
| `shadow-card` | Cards, list containers |
| `shadow-float` | Dropdowns, popovers (Select content) |
| Borders | Prefer border + subtle shadow over heavy shadow |

---

### 3.4 Iconography

- **Library:** [Lucide](https://lucide-react.dev/) (`lucide-react`)
- **Sizes:** `h-4 w-4` in buttons/nav; `h-3.5 w-3.5` in badges and row meta
- **Stroke:** Default Lucide stroke; do not mix icon sets

#### Icon mapping (standardize)

| Concept | Icon |
|---------|------|
| Open (metric) | `CircleDot` |
| Blocked | `Ban` / `Clock3` |
| Overdue | `AlertTriangle` |
| Done | `CheckCircle2` |
| Search | `Search` |
| Create | `Plus` |
| Assignees | Avatar stack (no extra `Users` icon) |
| Comments | `MessageSquare` |

**Rule:** Icons in Server Components stay on the server. Nav icons are defined inside client `MainNav.tsx` only.

---

## 4. Layout & navigation

### 4.1 App shell

- **Max width:** `max-w-7xl` centered content
- **Header:** Sticky, `bg-card/95 backdrop-blur`, two rows:
  1. Brand breadcrumb + user + sign out
  2. Primary nav (`MainNav`) with **active route** state

### 4.2 Primary navigation

| Route | Label | Notes |
|-------|-------|-------|
| `/issues` | Issues | Default home for ops work |
| `/projects` | Projects | Multi-issue initiatives |
| `/inbox` | Inbox | Notifications + assigned work |
| `/stores` | Stores | Location dashboard |
| `/warehouse` | Warehouse | Supply dashboard |
| `/hq` | HQ | Cross-location health |
| `/reports` | Reports | Weekly leadership review |
| `/pilot` | Pilot | Internal pilot feedback |
| `/admin` | Admin | Setup (admin only) |

**Active state:** `bg-primary text-primary-foreground` on current item. Inactive: muted with hover `bg-secondary/70`.

### 4.3 Page anatomy (list pages)

Use this template for `/issues`, `/projects`, and similar queues:

```
┌─────────────────────────────────────────────────────────┐
│ Page title + one-line description          [Primary CTA] │
├─────────────────────────────────────────────────────────┤
│ KPI strip (4 metrics, clickable)                         │
├─────────────────────────────────────────────────────────┤
│ Toolbar: Search · Saved views · Secondary actions        │
├─────────────────────────────────────────────────────────┤
│ Filters (labeled, show active state)                     │
├─────────────────────────────────────────────────────────┤
│ Work queue (table/list)                                  │
└─────────────────────────────────────────────────────────┘
```

**Avoid:** Duplicate KPIs in list header and hero.

---

## 5. Components

Components live under `src/components/ui/` (primitives) and `src/components/ops/` (domain).

### 5.1 Primitives (shadcn-style)

| Component | File | Notes |
|-----------|------|-------|
| Button | `ui/button.tsx` | Variants: default, secondary, outline, ghost, destructive, link |
| Input | `ui/input.tsx` | `rounded-md`, focus ring |
| Card | `ui/card.tsx` | `rounded-lg` |
| Badge | `ui/badge.tsx` | `rounded-md`; variants include success, warning, info |
| Select | `ui/select.tsx` | Radix-based; use for all dropdowns |
| SelectField | `ui/select-field.tsx` | Server-action forms with hidden input |

**Always use `Button` for actions** — do not hand-roll `inline-flex` link buttons unless `Link` + `buttonVariants` pattern is required.

### 5.2 Domain components

| Component | Purpose |
|-----------|---------|
| `IssueListRow` | Primary issue queue row |
| `StatusBadge` / `PriorityBadge` | Semantic issue state |
| `RoleBadge` / `LocationKindBadge` | People & place context |
| `AvatarStack` | Assignee preview |
| `ActivityTimeline` | Git-style history |
| `AssigneeSidebar` | People management on issue detail |
| `ProjectKanbanBoard` | Project status columns |
| `SavedViewsBar` | Saved filter shortcuts |
| `IssuesDensityToggle` | Comfortable / compact list |

### 5.3 Buttons

| Type | Variant | Example |
|------|---------|---------|
| Primary action | `default` | Save, Apply (if needed) |
| Create (preferred) | `default` | New issue |
| Secondary | `outline` | Export CSV |
| Quiet | `ghost` | Mark read |
| Danger | `destructive` | Delete (rare) |

**Layout:** Icon left of label, `gap-2`, height `h-10` default.

### 5.4 Form fields

- **Label:** `form-label` class or `FormField` from `src/components/ui/form-layout.tsx`
- **Grouped settings:** Use `FormShell`, `FormSection`, `FormRow` — place edit forms in a sidebar (`max-w-[380px]`) on detail pages, not full-width below content
- **Input / Select:** Never placeholder-only; placeholder supplements label
- **Textarea:** `form-textarea`, `min-h-28` for descriptions
- **Sidebar pickers (preferred):** GitHub-style field row — label + gear icon + summary (`None yet` or selected values). Popover contains filter input + searchable list with checkmarks. Use `SidebarField`, `SidebarListPicker`, `SidebarPeoplePicker` from `src/components/ops/`. Avoid long checkbox lists in sidebars.

**Select migration:** Native `<select className="form-select">` is deprecated — use `SelectField` or Radix `Select`.

### 5.5 Badges & chips

| Variant | Use |
|---------|-----|
| `outline` | Neutral tags, saved views (inactive) |
| `default` / `secondary` | Low emphasis counts |
| `destructive` | Blocked, urgent |
| `success` | Done |
| `info` | In progress |
| `warning` | High priority |

**Saved views (active):** Should use filled primary or secondary background — not identical to inactive outline badges.

### 5.6 Issue list row

**Visual hierarchy (target):**

1. Row 1: `StatusBadge` + `PriorityBadge` · due date (right)
2. Row 2: Title + mono issue number
3. Row 3: Location, kind, ≤2 labels (+N if more)
4. Row 4: Assignee avatars · comment count · checklist progress
5. Row 5 (comfortable only): Last activity one line

**Affordances:**

- Left border: location kind (`locationBorderClass`)
- Top inset shadow: urgent priority (`issue-row-urgent`)
- Hover: `hover:bg-accent/40`
- Entire row is one `<Link>`

**Compact mode:** Hide description and last activity; reduce vertical padding.

---

## 6. Patterns

### 6.1 Issues queue (`/issues`)

**User goal:** Find and open the right work item in under 10 seconds.

| Element | Specification |
|---------|----------------|
| KPIs | Open, Blocked, Overdue, Done — clickable to filter |
| Search | Submit on Enter; placeholder mentions `#`, title, assignee |
| Saved views | Distinct active state; 5–7 max visible |
| Filters | Labeled selects; show active filter chips |
| Empty | “No issues match” + Create + Clear filters |
| Loading | `loading.tsx` skeleton for metrics + rows |

### 6.2 Issue detail (`/issues/[id]`)

**User goal:** Understand context, update status, assign people, comment.

**Header (scan layer):** Title + mono issue number; **instant status picker** (sole status editor); urgent/high priority badge only when notable; read-only meta chips (location, type, labels, due/overdue, assignees link to `#people`).

**Main column (work layer):** Urgent or blocked callout when applicable → description → checklist + sub-issues (two columns only when both have content) → discussion (with note that system events live in Activity history) → **Activity history** card with outline **Export activity CSV**.

**Sidebar (`#issue-details`, ~380px):** People first (assignees, watchers), then metadata (type, priority, project, location, labels, due, blocked/next step). **One “Save changes”** button; status is not duplicated here (hidden field preserves server value on save).

**Mobile:** Collapsible **Details & people** above main column; full sidebar visible on `lg+`.

**Nav on scroll:** Read-only issue context (title + mono number + status dot); liquid glass on nav only.

### 6.3 Inbox (`/inbox`)

**User goal:** Triage notifications and assigned work.

- Unread first; assignment changes grouped
- Preferences use same form field standards as admin

### 6.4 Admin (`/admin`)

**User goal:** Configure locations, users, templates, verify system health.

- Three-column card grid on xl
- System health checklist with OK / Needs work rows
- Test notification form with labeled selects

### 6.5 Reports (`/reports`)

**User goal:** Run weekly ops review without a spreadsheet.

- KPI row → weekly movement → leadership readout → exports
- Plain-language insights (“Most blocked location”, etc.)

---

## 7. Content & voice

### 7.1 Tone

- **Direct** — “Blocked 72h+” not “This item may require attention”
- **Operational** — use store/warehouse/HQ vocabulary consistently
- **Neutral** — activity summaries state facts: “Ari assigned Bo”

### 7.2 Labels

| Prefer | Avoid |
|--------|-------|
| Open work | Openish (in UI copy; ok as filter key) |
| New issue | Create ticket |
| Work queue | Issue list container |
| Mark read | Dismiss (implies deletion) |

### 7.3 Placeholders (examples)

| Field | Placeholder |
|-------|-------------|
| Search | `Search by title, #42, assignee, location…` |
| Issue title | `Fix broken prep sink at Capitol Hill` |
| Comment | `Add an update or @mention a teammate` |
| Checklist item | `Add checklist item…` |

### 7.4 Empty states

Always offer **next action**:

- No issues → link to **New issue**
- No search results → **Clear filters** + adjust search hint
- No notifications → short explanation of what creates them

---

## 8. Motion & feedback

### 8.1 Principles

- Motion clarifies state change; it does not decorate.
- Respect `prefers-reduced-motion` (see `globals.css`).

### 8.2 Durations

| Interaction | Duration |
|-------------|----------|
| Hover / color | `150–200ms` |
| Toggle / density | `150ms opacity` on list |
| Dropdown open | Radix default + `animate-fade-in` |

### 8.3 Loading

| Surface | Pattern |
|---------|---------|
| Page navigation | Next.js `loading.tsx` skeleton |
| Filter apply | Skeleton rows or list opacity `50%` |
| Client toggle | Optimistic UI where safe (density); server refresh for data |

### 8.4 Status animation

- **Pulse dot:** `status-pulse-dot` on in-progress status only — do not combine with spinner icon on same badge.

---

## 9. Accessibility

### 9.1 Requirements (minimum)

- WCAG 2.1 Level AA for internal tools
- Keyboard access to all actions and filters
- Visible focus: `focus-visible:ring-2 focus-visible:ring-ring`
- `aria-current="page"` on active nav link
- `aria-label` on icon-only controls
- Form fields: associated labels or `aria-label`

### 9.2 Color & state

- Never encode state by color alone — pair with text and icon
- Blocked / urgent / overdue must be readable in badges and list rows

### 9.3 Touch targets

- Minimum **44×44px** touch target on mobile for primary actions
- List rows: full row tap target (already a link)

---

## 10. Implementation guide

### 10.1 File map

| Concern | Location |
|---------|----------|
| CSS tokens | `app/globals.css` |
| UI primitives | `src/components/ui/` |
| Domain UI | `src/components/ops/` |
| Semantic colors | `src/lib/ops/semantic.ts` |
| Shell & nav | `src/components/AppShell.tsx`, `MainNav.tsx` |
| Utilities | `src/lib/utils.ts` (`cn`) |

### 10.2 Adding a new component

1. Check if a primitive in `ui/` can be composed.
2. Match spacing, radius, and type scale from this doc.
3. Use semantic tokens — no hard-coded `#hex` in TSX.
4. Server vs client: mark `"use client"` only when using hooks, Radix, or browser APIs.
5. Add a row to **Components** table in this doc (or PR description).

### 10.3 Adding a new semantic color

1. Add CSS variable in `:root` in `globals.css`
2. Expose in `@theme inline`
3. Add to `semantic.ts` if domain-specific
4. Document in **Color** section above

### 10.4 Server / client boundary

**Do not pass** from Server → Client:

- React components (e.g. Lucide icons)
- Class instances, functions, Dates (serialize first)

**Pattern:** Define nav items and icons inside client `MainNav.tsx`; pass only serializable props (strings, numbers, plain objects).

---

## 11. Quality checklist

Use before shipping UI changes:

### Visual

- [ ] One H1 per page
- [ ] Consistent card radius (`rounded-lg`) and padding (`p-4`)
- [ ] No duplicate metrics on the same page
- [ ] Primary action obvious and uses `Button`
- [ ] Active nav and active filters visible

### Forms

- [ ] Every field has a visible label
- [ ] Placeholders are helpful, not sole label
- [ ] Dropdowns use Radix `Select` / `SelectField`

### Lists

- [ ] Row hierarchy: status → title → meta
- [ ] Badge count restrained above title
- [ ] Empty and loading states defined

### A11y

- [ ] Keyboard navigable
- [ ] Focus ring visible
- [ ] State not color-only

### Performance

- [ ] `loading.tsx` for slow routes
- [ ] No layout shift when filters apply

---

## 12. Roadmap

| Priority | Item | Status |
|----------|------|--------|
| P0 | Unify issues page toolbar; remove duplicate KPIs | Done |
| P0 | Filter labels + active filter chips | Done |
| P1 | Saved view active state | Done |
| P1 | Issue row badge hierarchy refactor | Done |
| P1 | `/issues/loading.tsx` skeleton | Done |
| P2 | Align “New issue” to primary button (not success green) | Done |
| P2 | Search UX (submit + result count) | Done |
| P3 | Dark mode tokens + theme toggle | Done |
| P3 | Formal Figma library synced to code | External / manual |

---

## References

- [Production runbook](./PRODUCTION_RUNBOOK.md) — deploy and Firebase safety
- [Next.js Vitest testing](https://nextjs.org/docs/app/guides/testing/vitest) — component tests
- [Radix Select](https://www.radix-ui.com/primitives/docs/components/select) — dropdown primitive

---

## Document history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | Design / Engineering | Initial system doc from codebase + issues page audit |

---

*This document is the source of truth for Seoul Bowl Ops UI. Propose changes via PR with screenshots and a short rationale against the principles in §2.*
