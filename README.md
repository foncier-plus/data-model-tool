# Data Flow

A local web tool to **edit, visualise and maintain a business object model** stored as
independent, human-readable YAML files. Each object describes its attributes grouped by
functional groups, and each attribute or group can declare where it comes from
(`origin`): one or more source elements and a formula. The dependency graph draws one card
per object — with its groups and attributes visible in place — and links that can be shown
either aggregated per object pair or one by one per `origin`.

The tool runs on **localhost** and reads/writes the `objects/` directory directly through
a small Vite middleware — no backend to deploy, no database, no cloud.

---

## Features

- **One object per file**, in a `objects/**/*.yaml` directory, editable by hand.
- **Namespaces**: sub-directories of `objects/` group objects. The header shows them and
  filters the graph; references are qualified with `.` (`sales.client.id`), so two objects may
  share a name in different namespaces. Origin autocomplete lists them all.
- **Full CRUD from the UI**: create / rename / delete objects, groups, attributes and
  origins, and **move an attribute between groups** (the group is only a context container,
  so the attribute name does not change). Changes are **auto-saved** to disk.
- **Human comments preserved**: YAML `#` comments already present in the files are kept
  intact across saves (they are not edited from the UI).
- **Reference validation**: unresolved references, duplicates, self references and cycles
  are reported in an issues panel.
- **Dependency graph, one node per object**: each object is a card containing its groups and
  attributes. The link mode follows the selection automatically:
  - selecting an object or a group shows **object links** — a single aggregated link per pair
    of objects, labelled with the number of underlying attribute links;
  - selecting an attribute shows **attribute links** — one link per `origin`, drawn between
    the exact rows.
- **Draw a link**: drag from an attribute's handle to another attribute; the origin is added to
  the attribute reached on the left.
- **Colour coded**: every object has a stable colour used for its card, its rows and its
  links; attribute types have their own badge colours; upstream is blue, downstream green,
  and the selection is highlighted.
- **Focused links**: selecting an object or an attribute bolds its incoming and outgoing
  links and hides the others; attribute links are drawn on top of the cards.
- **Directional placement**: a new object is placed in the column matching its **dependency
  depth**, so **sources sit to the left of their targets**; isolated objects take the next grid
  slot. After that cards only move when you drag them, and while you drag a card the others
  whose gap is below the **repulsion distance** (default 20 px, configurable from the gear menu)
  are **pushed away** so cards never overlap. Object anchors sit on the sides of the title.
- **Monospace card**: attribute names and type badges are rendered in a monospace font.
- **Attribute icons**: a computed attribute (with an origin) shows a white `Σ` on a pastel blue
  chip; a plain one shows a grey pencil on a light grey chip.
- **Card content**: the namespace (when any) is a coloured pill before the object name, the
  object description (wrapping) is shown under the title, the total attribute count is a bold
  white badge on the object colour, root attributes live in a dashed pseudo-group, and every
  group header shows its attribute count. Groups **and the root pseudo-group are collapsed by
  default** and expand with a chevron.
- **Movable nodes**: drag any object to reposition it; its position is kept while you edit.
- **Click inside the graph**: click a group or an attribute inside an object card to select
  and edit it, without leaving the graph; click the background to deselect.
- **Formula on demand**: the Formulas panel shows one clickable card per derivation with the
  attribute (bold), its **sources** (prefixed `- `) and, when defined, its **formula** (with no
  formula an `=` equality marker is shown instead; formulas are stored and displayed, never
  evaluated). Clicking a card selects the attribute, and selecting an attribute automatically
  expands the objects/groups that contain its origins.
- **Origin sources**: a `Sources` block with the new-source field on top (autocomplete over
  existing references, validated with a green check or Enter) and the committed sources below
  as blocks with a red trash inside.
- **Side panel, resizable and collapsible**: drag the divider to resize, or hide it from the
  header. A **breadcrumb** (`object › group › attribute`, each segment navigates) and a red
  trash deletes the current object. The tab strip (icons, very light grey, white
  active tab) holds **About** (name/description, group list), **Attributes** (the selected
  object's root attributes or the selected group's attributes) and **Formulas** / **Source**.
  Creating a group or an attribute is done by typing a name in an empty field and validating
  with the green check (or Enter); deletion uses the red trash on each row. The attribute panel
  edits group/name/type/description/origin; the type can be typed manually, the group is a free
  combobox (an existing name moves the attribute, a new name creates the group, `X` sends it
  back to the root attributes). All edit fields use a monospace font (`text-xs`), the Origin
  block is muted, and every attribute row shows a coloured `Σ` (derived) or a pencil (plain).
- **Source tab**: view and edit the raw YAML of the selected object, with syntax highlighting;
  Apply re-parses it and refuses to save on a YAML error.
- **Conflict-safe autosave**: if a file changed on disk while you were editing, the app
  detects it and asks whether to reload or overwrite.

## Tech stack

| Layer          | Choice                                                   |
| -------------- | -------------------------------------------------------- |
| Build tool     | [Vite 8](https://vite.dev)                               |
| UI library     | [React 19](https://react.dev)                            |
| Language       | JavaScript (ESM) — **no TypeScript**                     |
| Styling        | [Tailwind CSS 4](https://tailwindcss.com)                |
| Components     | [shadcn/ui](https://ui.shadcn.com) (new-york style)      |
| Routing        | [React Router 7](https://reactrouter.com)                |
| Icons          | [lucide-react](https://lucide.dev)                       |
| YAML (CST)     | [yaml](https://eemeli.org/yaml) — comment-preserving     |
| Validation     | [zod](https://zod.dev)                                   |
| State          | [zustand](https://zustand.docs.pmnd.rs)                  |
| Graph          | [@xyflow/react](https://reactflow.dev)                   |
| Files API      | Vite middleware (Node `fs`)                              |
| Tests          | [Vitest](https://vitest.dev) + Testing Library           |
| Linting        | [oxlint](https://oxc.rs)                                 |

## Requirements

- **Node.js 20.11+** (developed on Node 26)
- **npm 10+**
- A Chromium-based browser is recommended for development, but the middleware approach
  works in any modern browser.

## Installation

```bash
git clone <repository-url> data-flow
cd data-flow
npm install
```

## Usage

```bash
npm run dev
```

Open <http://localhost:5173>. The app loads every `objects/*.yaml` file. Vite's dev watcher
ignores the `objects/` directory, so autosaves never trigger a page reload.

- **Graph (full width)** — one card per object showing its groups and attributes. The link
  mode follows the selection: selecting an object or a group shows **object links** (aggregated
  per pair), selecting an attribute shows **attribute links** (per `origin`). Click a group or
  attribute inside a card to select it; drag a card to move it (the neighbours within the
  repulsion distance move away); scroll to zoom, use the controls to fit, and open the **gear**
  menu to tune the repulsion distance.
- **Right panel** — a breadcrumb on top, then `About` for the selected element, `Attributes`
  for the list of the selected object/group, `Formulas` for its origins and `Source` for the
  highlighted YAML of the object.
- **Header** — save status, issues count, **Refresh** (re-reads the directory) and
  **New object**.

### Autosave and conflicts

Every edit is written back after a short debounce. Because the files are meant to be edited
by hand too, the app compares a content hash before writing: if the file changed on disk
while the app was open, a dialog lets you **Reload from disk** or **Overwrite**.

### Adding an object manually

Create a new `.yaml` file in `objects/` and click **Refresh**. The file must have at least
a `name` key.

## YAML format

One file per object. `name` is both the identifier used in references and the display
label; by convention it matches the file name.

```yaml
# objects/client.yaml
name: client
description: Natural or legal person bound by a contract.

attributes: # attributes outside any group (optional)
  - name: id_client
    type: string
    description: Client identifier, inherited from the third party.
    origin:
      from: [tiers.id]
      formula: tiers.id

groups:
  - name: identity
    description: Identification data of the client.
    attributes:
      - name: first_name
        type: string
        description: Given name.
      - name: last_name
        type: string
        description: Family name.
        # Used in most downstream documents.
      - name: full_name
        type: string
        description: Display name built from the first and last name.
        origin:
          from: [client.first_name, client.last_name]
          formula: "first_name + ' ' + last_name"
```

### Fields

| Field         | Where                | Description                                                       |
| ------------- | -------------------- | ----------------------------------------------------------------- |
| `name`        | object / group / attr | Label. Required. For an object, the file path is the reference identifier. |
| `description` | object / group / attr | Free text.                                                        |
| `type`        | attribute            | One of `string, number, integer, boolean, date, datetime, enum, ref, array`. Optional. |
| `optional`    | attribute            | `true` marks the attribute optional (default: mandatory). Optional attributes are shown in italic. |
| `example`     | attribute            | Free-text example, shown in italic.                              |
| `origin.from` | group / attribute    | List of references to source elements.                            |
| `origin.formula` | group / attribute | Free-text formula, displayed on demand.                          |

A `#` comment placed on the line(s) above an object, group or attribute is the element's
comment. Comments already present in the files are preserved across saves but are no longer
edited from the UI.

### References

| Target                    | Syntax                        |
| ------------------------- | ----------------------------- |
| Object                    | `object` (`sales.client`)     |
| Group                     | `object.group`                |
| Attribute (root or grouped)| `object.attribute`           |

References use `.` as the namespace separator: `A.b.c` where `A` is the namespace (optional —
absent means the current file's namespace), `b` the object and `c` the property, e.g.
`sales.client.id`. The file path keeps `/` (`sales/client.yaml`). In a namespaced file a bare
reference defaults to that file's namespace (`tiers.id` in `sales/client.yaml` resolves to
`sales.tiers.id`); write `crm.tiers.id` to reach another namespace. An attribute is
always referenced by `object.attribute`: the group is only a context
container and never appears in a reference (e.g. `client.last_name`).

References are validated; unknown ones appear as issues and are struck through in the
Formulas panel.

## HTTP API

The Vite middleware exposes (in `dev` and `preview`):

| Method   | Route                          | Description                              |
| -------- | ------------------------------ | ---------------------------------------- |
| `GET`    | `/api/objects`                 | List all files with content and hash.    |
| `GET`    | `/api/objects/:name`           | Read one file.                           |
| `POST`   | `/api/objects`                 | Create a file (`{ name, content }`).     |
| `PUT`    | `/api/objects/:name`           | Write a file (`{ content, baseHash }`).  |
| `DELETE` | `/api/objects/:name?baseHash=` | Delete a file.                           |
| `POST`   | `/api/objects/:name/rename`    | Rename (`{ to, content }`).              |

A mismatched `baseHash` returns `409` with the current content. Access is restricted to
`objects/` and to `.yaml`/`.yml` names (no path traversal).

## Production build

```bash
npm run build     # outputs dist/
npm run preview   # serves dist/ AND the /api/objects middleware
```

`npm run preview` is a fully working local server: the middleware is registered for the
preview server too.

## Project structure

```
data-flow/
├── objects/                    # your object files (one per object, sub-dirs = namespaces)
├── plugins/objects-api.js      # Vite middleware exposing /api/objects
├── server/objects.js           # filesystem repository (read/write/hash/rename)
├── src/
│   ├── components/
│   │   ├── editor/             # ObjectForm, GroupForm, AttributeForm, OriginForm, fields
│   │   ├── graph/              # GraphView, EntityNode, directional placement, LayoutSettings
│   │   ├── panels/             # Breadcrumb, Inspector, FormulaPanel, SourcePanel
│   │   ├── ConflictDialog.jsx  # 409 conflict resolution
│   │   ├── NewObjectDialog.jsx
│   │   └── ui/                 # shadcn/ui primitives (generated, do not hand-edit)
│   ├── lib/
│   │   ├── model/              # schema, parse, serialize, comments, mutations, refs, graph
│   │   ├── store/              # zustand store (autosave, conflicts, selection)
│   │   ├── api.js              # /api/objects client
│   │   ├── colors.js           # object/type colour codes
│   │   ├── selection.js        # selection helpers
│   │   └── utils.js            # cn()
│   ├── test/setup.js           # jsdom polyfills for React Flow
│   ├── pages/Workspace.jsx
│   ├── App.jsx
│   ├── index.css               # Tailwind entry + design tokens
│   └── main.jsx
├── components.json             # shadcn/ui configuration
├── vite.config.js              # Vite + Tailwind + objects API
├── vitest.config.js
├── MEMORY.md                   # internal knowledge base
└── BACKLOG.md                  # planned work
```

## Maintenance

```bash
npm run lint       # oxlint
npm test           # vitest run
npm run test:watch # vitest watch
npm run build      # production build
```

### Conventions

- **No TypeScript** — plain `.js` / `.jsx`; use JSDoc when typing helps.
- **No comments in code** unless they explain a non-obvious *why*.
- Import via the `@/` alias, never long relative paths across folders.
- Never hand-edit `src/components/ui/`; add components with
  `npx shadcn@latest add <name>` and customise by wrapping them.
- Model logic lives in `src/lib/model/` and is unit-tested; keep UI components thin.

### Adding shadcn/ui components

```bash
npx shadcn@latest add <component>
```

The CLI emits `.jsx` (see `"tsx": false` in `components.json`).

## License

Private / unlicensed unless stated otherwise.
