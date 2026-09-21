# BACKLOG

Planned work for **Data Flow**. Priorities: **P0** must-have, **P1** important,
**P2** nice-to-have.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## 0. Product definition

**Goal** — Provide a local web tool to edit, visualise and maintain a business object
model where each object is an independent, human-readable, commentable YAML file, and where
every attribute or group can declare what it derives from (sources + formula), with a
dependency graph of object cards whose groups and attributes are visible in place.

**Users** — Data architects / analysts maintaining a data dictionary and lineage, working
locally on a set of YAML files versioned alongside the project.

**v1 success criteria** (all met):

- [x] Create / edit / delete objects, groups, attributes, descriptions and origins from the
      UI, auto-saved to disk.
- [x] Hand-written YAML comments and key order are preserved across saves.
- [x] A YAML file added manually appears after **Refresh**.
- [x] The graph shows each object as a card with its groups and attributes, and can switch
      between aggregated object links and per-origin attribute links.
- [x] Selecting an element shows its formula on demand and highlights its dependencies.
- [x] Objects can be moved and never overlap by default.
- [x] No write outside `objects/`; external changes are detected (409 conflict).

## 1. Foundation — done

- [x] Vite + React 19 in JavaScript (no TypeScript)
- [x] Tailwind CSS v4 through `@tailwindcss/vite`
- [x] shadcn/ui configured for `.jsx` output
- [x] React Router, sonner toasts, oxlint, Vitest
- [x] **PWA removed** (not needed)
- [x] Git repository and `README.md`, `MEMORY.md`, `BACKLOG.md`

## 2. Model & filesystem — done

- [x] YAML formalism (objects, groups, attributes, origin, comments)
- [x] Comment-preserving CST parse / serialise round-trip
- [x] zod schema validation
- [x] Reference index, unresolved / duplicate / self / cycle detection
- [x] Vite middleware API: list, read, create, write, delete, rename
- [x] Content hashing + conflict detection + path-traversal guards
- [x] Direct read/write of a fixed `objects/` directory

## 3. UI — done

- [x] Graph + inspector layout (the left tree panel was removed as redundant)
- [x] Object, group and attribute forms (description, type, origin)
- [x] Add / remove objects, groups and attributes
- [x] **Move an attribute between groups** (group = context container, name unchanged)
- [x] Origin autocomplete (object then element, native datalists)
- [x] Object rename (file rename)
- [x] Autosave with status indicator and conflict dialog
- [x] Formula panel as an attribute / sources / formula table
- [x] Issues panel (broken references, duplicates, cycles)
- [x] Refresh button
- [x] **Object-level graph**: groups and attributes rendered inside each object card
- [x] **Two link modes**: aggregated `Object links` / per-origin `Attribute links`
- [x] Upstream/downstream highlighting at object and attribute level
- [x] Non-overlapping default placement (grid slot per new object; no automatic repositioning)
- [x] **Draggable** object cards (manual positions kept across edits)
- [x] **Colour codes**: stable colour per object, per-type attribute badges
- [x] Homogeneous card rows (fixed grid and heights)

## 4. Next — P0

- [ ] **Undo / redo** on model edits (per file, based on CST snapshots)
- [ ] **Search / filter** the graph by object, group, attribute or formula
- [ ] **Broken reference quick-fix**: click an unresolved reference to pick an existing
      element or create it
- [ ] **Deep-link selection** in the URL (`/object/:object/:group?/:attribute?`) so a
      selection survives a reload and can be shared

## 5. Next — P1

- [ ] **File watcher + SSE** to auto-refresh when files change on disk (replacing the
      manual Refresh button)
- [ ] **Graph layout persistence** (remember node positions across reloads)
- [~] **Directional placement** (done: new connected cards are placed by dependency depth so
      sources are left of targets; cards repel each other while dragging) — a **full automatic
      layout** is still open.
- [ ] **Reset layout** button (clear frozen positions and re-run the layout)
- [ ] **Collapse object cards** to show only the header
- [ ] **Filter the graph** by object or by depth (upstream/downstream N levels)
- [ ] **Cross-object impact view**: full upstream/downstream path highlighting beyond
      direct neighbours
- [ ] **Enum values** for `type: enum` (list of allowed values, edited in the UI)
- [ ] **Markdown descriptions** rendered in the details panel
- [ ] **Keyboard shortcuts** (save, delete, jump to formula)
- [ ] **Import / export**: ZIP of the `objects/` directory, CSV of the flattened model
- [ ] **Reference autocomplete** in the Origin form (pick from the index instead of typing)
- [ ] **Diff view** before overwriting a conflicting file

## 6. Next — P2

- [ ] **Formula validation**: parse formulas and check referenced identifiers
      (still no evaluation)
- [ ] **Formula evaluation** with a sandboxed expression parser (opt-in)
- [ ] **History**: read git history of a file and show model evolution
- [ ] **Multi-directory / workspace** support (choose the objects folder)
- [ ] **Collaboration**: backend with concurrent editing
- [ ] **Alternative graph layouts** (hierarchical/dagre, radial)
- [ ] **Export diagrams** (PNG / SVG) and documentation (Markdown / HTML site)
- [ ] **Dark mode toggle** in the UI (tokens already exist)
- [ ] **i18n** of the UI

## 7. Quality & tooling

- [x] Vitest: model round-trip, references, graph aggregation, workspace smoke test
- [ ] P1 — Component tests for the forms (add/edit/delete flows)
- [ ] P1 — End-to-end test (Playwright) covering create → edit → autosave → reload
- [ ] P1 — Prettier + editor config
- [ ] P1 — CI pipeline (lint, test, build) on pull requests
- [ ] P2 — Pre-commit hooks (husky + lint-staged)
- [ ] P2 — Bundle-size budget / code-splitting (current bundle is ~900 kB)
- [ ] P2 — Accessibility audit (axe, keyboard navigation)
- [ ] P2 — File-size limits and graceful handling of very large models

## 8. Deployment

- [x] Runs locally via `npm run dev` and `npm run preview` (middleware included)
- [ ] P2 — Optional packaged binary / `npx` launcher for non-developers
- [ ] P2 — Optional Docker image serving `dist/` + the objects API
- [ ] P2 — Document a "static read-only" deployment (no API, import files in the browser)

## 9. Documentation

- [x] README: format, API, usage, maintenance
- [x] MEMORY: architecture, decisions, comment-handling subtleties
- [ ] P1 — Data-model documentation generated from the `objects/` files
- [ ] P2 — Architecture diagram and contributor guide
