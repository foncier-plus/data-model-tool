# MEMORY

Internal knowledge base for **Data Flow**. It records how the project works, the decisions
behind it and the traps to avoid. Update it whenever something non-obvious is learned.

---

## 1. Purpose

A local (localhost) editor and visualiser for a **business object model**:

- Objects have attributes, optionally grouped into functional groups.
- Every object is a standalone YAML file, human-readable and commentable.
- Attributes and groups can declare an `origin` (sources + formula) describing what they
  are derived from.
- The UI edits the files on disk and draws the dependency graph.

## 2. High-level architecture

```
Browser (React SPA)
  ├─ zustand store ──> src/lib/model/* (CST + model + refs + graph)
  │        │
  │        └─ fetch /api/objects
  └─ React Flow graph
                │
Vite dev/preview server
  └─ plugins/objects-api.js ──> server/objects.js ──> objects/**/*.yaml (fs)
```

There is **no database and no remote backend**. The Vite plugin registers the same
middleware for `configureServer` (dev) and `configurePreviewServer` (preview), so the tool
works identically in `npm run dev` and `npm run preview`.

`objects/` may contain **sub-directories**: each directory path is a **namespace**. The
namespace is not stored in the YAML; it is derived from the file path. **References use `.` as
the separator** (not `/`): `A.b.c` where `A` is the namespace (optional — absent means the
file's own namespace), `b` the object and `c` the property, e.g. `sales.client.id`. The file
path keeps `/` (`sales/client.yaml`); `toEntry` builds `qualifiedName = 'sales.client'` and
`namespace = 'sales'` by replacing `/` with `.`. Root objects have no namespace and keep a bare
name.

## 3. Key decisions

| Decision | Rationale |
| --- | --- |
| **Vite middleware instead of File System Access API** | FS Access requires a user gesture to pick a directory and is Chromium-only. The middleware reads/writes a **fixed** `objects/` path with no user interaction, and works in every browser. |
| **YAML, one file per object** | Human-readable, supports `#` comments, easy to diff and version. |
| **The file path is the object's qualified name** | `name` (YAML) is the label; references use the path without extension (`sales.client.id`), so two objects may share a bare `name` in different namespaces. |
| **Sub-directories are namespaces** | Organisational grouping, surfaced as a filter in the top bar and in the origin autocomplete. Nothing namespace-specific is stored in the YAML. |
| **Comment-preserving CST editing (`yaml` package)** | Hand-written comments must not be destroyed. We mutate the YAML Document (CST) instead of re-serialising a plain object. Comments are **not editable in the UI** but are preserved across saves. |
| **CST is the source of truth** | The plain model is *derived* (`deriveModel`) for validation, refs and graph. UI edits mutate the CST. |
| **Formulas stored, never evaluated** | Requirement: show formulas on demand. No expression parser, no security surface. |
| **zod for validation** | Small, declarative schema; unknown keys are stripped. |
| **zustand for state** | Minimal boilerplate, actions can hold module-level autosave timers. |
| **React Flow, one node per object** | Groups and attributes are rendered *inside* the object card. There is no semantic zoom: a single object-level graph is easier to read. |
| **Two link modes** | `Object links` aggregates every dependency into one link per object pair; `Attribute links` draws one link per `origin` between the exact rows. The mode is derived from the selection (selecting an **attribute** shows attribute links), never persisted. |
| **Groups are context containers** | A group only groups attributes; moving an attribute between groups (or to the root) does **not** change its name. Group `origin` is read/preserved if present but the UI never offers it. |
| **Directional grid placement** | A new **connected** card is placed in the column matching its **dependency depth** (sources are lower/left, targets higher/right) and stacked below the cards already in that column; an **isolated** card takes the next grid slot. Cards are otherwise only moved by the user — nothing repositions them automatically. |
| **Repulsion while dragging** | When a card is dragged, the cards whose gap is below the **repulsion distance** (default **20 px**, configurable from the gear menu) are pushed away, so cards never overlap while moving. The gap uses React Flow's **measured** card size, not the content estimate (a collapsed card is much shorter than `objectHeight` assumes, which made short cards repel distant neighbours). |
| **Colour per object** | A stable hash-based colour (`src/lib/colors.js`) makes cards, rows and links identifiable at a glance. |
| **No left tree panel** | The graph cards already expose every object, group and attribute, so a tree would be redundant. Selection happens in the graph; the Inspector does the editing. |
| **JavaScript only** | Explicit project requirement. No `.ts`/`.tsx`, no `tsconfig.json`. |

## 4. YAML formalism

```yaml
name: client                # identifier + label
description: ...
attributes:                 # root-level attributes (optional)
  - name: id_client
    type: string
    description: ...
    origin:
      from: [tiers.id]
      formula: tiers.id
groups:
  - name: identity
    description: ...
    attributes:
      - name: full_name
        type: string
        description: ...
        # free comment attached to this attribute
        origin:
          from: [client.first_name, client.last_name]
          formula: "first_name + ' ' + last_name"
```

Canonical key order enforced on every write:

- object: `name, description, attributes, groups`
- group: `name, description, origin, attributes`
- attribute: `name, type, optional, example, description, origin`
- origin: `from, formula`

Empty scalar keys are removed; empty `attributes`/`groups` sequences are removed when the
last item is deleted. `origin` is removed when both `from` and `formula` are empty. An
attribute is **mandatory by default**; `optional: true` is written only when it is optional,
and the key is deleted when it goes back to mandatory. `example` is a free string (empty
removed).

Reference syntax: `object`, `object.group`, `object.attribute`, where `object` is the
**qualified name** (path with `/` replaced by `.`, e.g. `sales.client`). **Attribute refs never
include the group**: a grouped attribute `last_name` in `client.identity` is referenced as
`client.last_name`, because a group is only a context container. `groupRef` is still
`object.group` and is used for group-level origins (legacy) and graph handles.

## 5. Comment handling — the subtle part

The `yaml` package attaches comments to different nodes depending on position:

| Comment position | Node holding it |
| --- | --- |
| Above the **first** item of a sequence | the **sequence** (`seq.commentBefore`) |
| Above any **later** sequence item | the **item** (`item.commentBefore`) |
| Above a map field | `pair.key.commentBefore` |
| Inline after a value | `pair.value.comment` |
| At the very top of the file | `doc.contents.items[0].key.commentBefore` |

Consequences:

1. `src/lib/model/comments.js` **normalises** sequence-level comments onto the first item
   (`normalizeComments`), so the model always reads an element's comment from the element.
   It runs on parse and on every serialise.
2. `commentBefore` values must start each line with a **space**, because `yaml` renders
   `'# ' + line` via `str.replace(/^(?!$)(?: $)?/gm, '#')`. Without the leading space the
   output is `#comment` (no space). `writeComment` adds it; `readComment` strips it.
3. `commentBefore` **cannot be an array** — passing one throws. It is a newline-joined
   string.
4. `doc.toString({ flowCollectionPadding: false, lineWidth: 0 })` is required for stable,
   predictable output (otherwise flow sequences become `[ a, b ]` and long lines wrap).

## 6. File-by-file notes

### `server/objects.js`
- `createObjectsRepository(objectsDir)` — `list`, `read`, `create`, `write`, `remove`,
  `rename`.
- Names may contain `/` segments (namespaces): the pattern is
  `^SEGMENT(/SEGMENT)*\.ya?ml$` with `SEGMENT = [A-Za-z0-9][A-Za-z0-9._-]*`. `..` is rejected
  and the resolved path must stay **inside** the objects directory (`path.relative` guard).
- `list()` walks sub-directories recursively and returns paths relative to the objects root
  (`sales/client.yaml`). `create`/`rename` `mkdir -p` the parent directory first.
- Each record carries a **sha256 `hash`** of the content and the `mtime`.
- `write`/`remove` accept a `baseHash`; on mismatch they throw `ObjectsError(409)` with
  `currentHash` and `currentContent`. This is what powers conflict detection.
- `create` uses `flag: 'wx'` so it fails (409) instead of overwriting.
- `rename` writes the target with `wx` then unlinks the source.

### `plugins/objects-api.js`
- `readJsonBody` enforces a 5 MB limit.
- Route parsing strips a `/rename` suffix before extracting the file name.
- `objectsApiPlugin()` registers the middleware for both dev and preview servers.
- `path.resolve(root, 'objects')` — `root` is `server.config.root`, so the directory is
  always `<project>/objects`.

### `vite.config.js`
- `server.watch.ignored: ['**/objects/**']` — otherwise Vite's dev watcher sees every autosave
  write to `objects/` and triggers a page reload, which would interrupt editing.

### `src/lib/api.js`
- Thin `fetch` wrapper; non-OK responses throw an `Error` with `.status` and `.data`
  (used to detect 409 conflicts).

### `src/lib/model/schema.js`
- zod schemas + `validateModel` (returns `{ model, issues }`, never throws).
- `ATTRIBUTE_TYPES` is the single source of truth for the type dropdown.

### `src/lib/model/parse.js`
- `parseObjectFile(fileName, text)` → `{ fileName, doc, raw, model, errors }`.
- `deriveModel(doc)` → `{ raw, model, errors }` from the CST, without re-parsing.
- `asArray(node)` exists because a `YAMLSeq` is **not** an `Array` — it has `.items`. All
  sequence reads go through it.
- `originFromNode` unwraps `Scalar.value` from the `from` sequence.

### `src/lib/model/serialize.js`
- `serializeObject(doc)` normalises comments then stringifies with the options above.
- `blankObjectFile(name)` is the template used by "New object".

### `src/lib/model/mutations.js`
- CST mutations: `setObjectField`, `addGroup`, `removeGroup`, `setGroupField`,
  `addAttribute`, `removeAttribute`, `moveAttribute`, `setAttributeField`.
- `moveAttribute(doc, fromGroupIndex, attributeIndex, toGroupIndex)` **moves the CST node**
  (same object, comments included) from one attribute sequence to another. It does not touch
  the `name`: a group is only a context container. Empty source sequences are pruned. The
  group indices are stable because pruning only removes an `attributes` key, never a group.
- `setScalar` mutates the existing Scalar's `.value` when the pair exists, which preserves
  the key's comment.
- `orderPairs` sorts pairs into the canonical order; JS sort is stable so unknown keys keep
  their relative order.
- `uniqueName` appends `_2`, `_3`, … when adding `new_attribute` / `new_group`.
- `origin.from` is written as a **flow** sequence (`seq.flow = true`).
- `comment` keys are still handled (for the model/tests) even though no UI form calls them.

### `src/lib/model/refs.js`
- `entryName(entry)` = `entry.qualifiedName ?? entry.model.name`. **Every ref helper takes the
  qualified name**, not the bare YAML name: `objectRef(name)`, `groupRef(name, group)`,
  `attributeRef(name, _group, attribute)`.
- `attributeRef(objectName, _groupName, attributeName)` deliberately **ignores the group**:
  refs are `object.attribute`. Root and grouped attributes therefore share the same key space
  (a name used twice in different groups is an ambiguous/duplicate ref).
- `buildIndex(objects)` → `Map<ref, Element[]>` (arrays because a ref can be ambiguous).
- `resolveRef(ref, index, namespace)` prefers `attribute` > `group` > `object` when several
  elements share a ref. **A bare ref defaults to the file's namespace**: with a `namespace`
  it first tries `${namespace}.${ref}` (`tiers.id` in `sales/client` → `sales.tiers.id`) and
  falls back to the exact ref, so a namespaced file can reference its siblings unqualified
  while explicit `crm.tiers.id` still works. Callers pass `entry.namespace` (validation,
  graph, `EntityNode.isUnresolved`, `FormulaPanel`).
- `validateReferences` reports `unresolved`, `duplicate`, `self` and `cycle` issues.
- `collectOrigins(model)` flattens every origin of an object (root attributes, groups and
  grouped attributes) — used by the graph and the Formulas panel. The `name` of a grouped
  attribute is the bare attribute name (no group prefix).
- `objectElements(model)` returns the deduped element names used for the Origin autocomplete
  (attribute names without group prefix, plus group names).

### `src/lib/model/graph.js`
- `buildObjectGraph` — one node per object (carrying its `model`) and **one aggregated edge
  per ordered pair of objects**, with a `count` and a `details` list. Self-links and links
  to unknown objects are skipped.
- `selectionObjectId(selection)` maps any selection (object, group or attribute) to its
  owning object id, used to highlight and dim nodes.
- `graphNeighbors(graph, nodeId)` computes upstream/downstream object ids.
- `buildAttributeEdges(objects, index)` returns one edge per `origin` reference. Each edge
  carries `source`/`target` (the **object** ids used by React Flow) plus
  `sourceHandle`/`targetHandle` (the **element refs**, e.g. `client.full_name`) and
  `sourceRef`/`targetRef` for highlighting. Object-level sources and unknown targets are
  skipped. Intra-object links (same object) are kept — React Flow draws them as self-loops.
- There are deliberately **no group- or attribute-level graphs**: groups and attributes are
  rendered *inside* the object cards, not as separate graph levels.

### `src/lib/colors.js`
- `colorFor(name)` returns a stable colour from a 12-entry palette using a string hash, so
  an object keeps the same colour across sessions and reorderings.
- `withAlpha(hex, alpha)` produces an `rgba()` tint used for card headers/borders.
- `typeStyle(type)` maps an attribute type to a Tailwind badge class; `TYPE_STYLES` is the
  lookup table.

### `src/lib/store/useProjectStore.js`
- Holds `entries` (one per file: `fileName`, `qualifiedName`, `namespace`, `doc`, `raw`,
  `model`, `hash`, `content`, `dirty`, `errors`), plus `status`, `message`, `conflict`,
  `selection`, `panelTab` (`edit` | `attributes` | `formula` | `source`).
- `toEntry(file)` builds an entry from an API file record: `qualifiedName` = path without
  extension, `namespace` = directory part or `null`. Used by `refresh`, `createObject` and
  `resolveConflictReload`.
- `createObject(name)` accepts `namespace/name`; the YAML `name` is the **base** name while the
  file path (and selection) use the full qualified name. `renameObject` keeps the namespace
  (base name only).
- `applyMutation(fileName, mutator)` mutates the CST, re-derives the model, marks dirty and
  schedules the autosave.
- `applySource(fileName, text)` parses raw YAML, **rejects it on YAML errors** (returns
  `{ ok:false, errors }`), otherwise normalises comments, re-derives the model, marks dirty and
  schedules the autosave (returns `{ ok:true, content }`). This powers the Source tab.
- Autosave timers live in a **module-level `Map`** (outside the store) and fire after
  `SAVE_DELAY = 700 ms`. `flush` serialises and `PUT`s with the current hash.
- A `409` sets `conflict`; the dialog offers reload (re-read file) or overwrite (adopt the
  disk hash and re-flush).
- `refresh` re-reads every file and drops the selection if its ref no longer resolves.

### `src/components/graph/layout.js`
- `objectHeight(model)` estimates a card's height from its content; `objectSize` adds the
  fixed `NODE_WIDTH = 300`.
- `gridPosition(slot)` returns a deterministic **grid slot** (`4` columns, `NODE_WIDTH + 80`
  per column, `280` per row), used for isolated cards.
- `COLUMN_WIDTH = NODE_WIDTH + 80` is the horizontal step between dependency columns.
- `computeDepths(nodes, edges)` returns `Map<id, depth>` where `depth(target) = max(depth(source)) + 1`
  (relaxation passes, capped at `nodes.length` so cycles stay finite). It powers the
  **directional placement** (sources left).
- `nextRowY(x, width, occupied, gap)` returns the first `y` below the cards that overlap the
  column `x`, so a new card never overlaps the existing ones.
- `separateOverlaps({ nodes, positions, fixed, padding, passes })` returns a **cloned**
  position map with the rectangles whose gap is below `padding` pushed apart (uniform grid,
  ~O(n)); it powers the **drag repulsion**.

### `src/components/graph/LayoutSettings.jsx`
- Overlay (absolute, `bottom-3 left-14`, above the React Flow controls) opened by the gear
  `ControlButton`, with a single `Distance de répulsion` slider. The gear icon uses
  `style={{ fill: 'none' }}` so React Flow's `.react-flow__controls-button svg { fill: currentColor }`
  does not fill the stroked lucide gear into a solid blob.

### `src/components/graph/GraphView.jsx`
- Single-level graph: object cards only, no semantic zoom, no level buttons.
- **Link modes are derived, there is no toggle**: `edgeMode = selection?.kind === 'attribute'
  ? 'attribute' : 'aggregated'`. Selecting an attribute shows the per-row links; selecting an
  object or a group falls back to aggregated object links.
- **Connecting two attributes**: `onConnect` calls the store's `linkAttributes(sourceRef,
  targetRef)`, which appends `sourceRef` to the target attribute's `origin.from` (the target is
  the handle on the **left**, so the origin is written on the object reached from the left).
  Only connections between two attribute handles are accepted (title handles / groups are
  ignored).
- **Namespace filter**: `GraphView` receives a `namespace` prop. The index/graphs are always
  built from **all** entries (so refs resolve across namespaces), then nodes/edges are filtered
  to the selected namespace for display (`node.namespace === namespace`, edges kept only when
  both ends are visible).
- **Placement**: a `positions` ref (`Map<id, position>`) is the single source of truth, plus a
  `nextSlot` counter for isolated cards. When a new node appears, `computeDepths` gives its
  dependency depth and it is placed at `depth * COLUMN_WIDTH`, stacked with `nextRowY` below
  the cards already in that column (so **sources are left of their targets**); an isolated
  node falls back to `gridPosition(nextSlot++)`. Existing/manual positions are never changed.
  The sizes used by `nextRowY` come from the **measured** dimensions when available (a
  `nodesRef` updated in an effect), falling back to `objectSize`. `objectGraph`/`activeEdges`
  drive the effect so card `data` refreshes on every edit.
- **Dragging**: nodes are `draggable: true`. `onNodeDrag` treats the dragged card as fixed and
  runs `separateOverlaps` with `padding = repulsionDistance`, so the cards within the
  **repulsion distance** (default 20 px, gear menu) are **pushed away** and never overlap while
  moving. The sizes passed to `separateOverlaps` are the **measured** dimensions
  (`node.measured ?? NODE_WIDTH` / `objectSize`), never the content estimate alone: groups are
  collapsed by default, so `objectHeight` overestimates a card and would push distant cards.
  `onNodeDragStop` records the final position in the `positions` ref.
- **The `fitView` prop is deliberately NOT used.** It runs once on mount when the node list
  is still empty, so it never frames anything. Instead an effect calls
  `useReactFlow().fitView()` once per topology (the sorted set of object ids), so adding or
  removing an object refits, while edits, selection changes and mode switches do not move the
  viewport.
- **Handle changes require an explicit `updateNodeInternals`.** React Flow only recomputes a
  node's `handleBounds` when the node type or source/target position changes — *not* when
  the set of handles changes. Since the attribute mode mounts one handle pair per row, the
  effect calls `updateNodeInternals(objectGraph.nodes.map((n) => n.id))` after each layout.
  Calling it with **no arguments does nothing** (the hook maps an id/array of ids).
- Cards are created with `style: { width: NODE_WIDTH }` and **no height**, so React Flow
  measures them. When re-creating nodes, `...existing` is spread first so React Flow's internal
  `measured` field is preserved.
- `nodes`/`edges` are controlled via `useNodesState`/`useEdgesState`. The layout effect
  rebuilds the array (preserving `data`), and a second effect updates only highlight/dim
  styles when the selection changes, so layout is not recomputed on every click.
- Highlighting:
  - object mode → selected object plus upstream/downstream objects;
  - attribute mode → `refNeighbors` (upstream/downstream **refs**) are passed to every card
    so the exact rows light up (upstream blue, downstream green).
  Non-related nodes are dimmed.
- Edges are coloured with the **source object's** colour (`markerEnd.color` included) and
  their opacity/stroke width follow the selection. Edges are the default **curved** React Flow
  bezier. The React Flow edge objects **must carry `sourceRef`/`targetRef`** copied from
  `buildAttributeEdges`: the selection effect matches on those refs, so dropping them silently
  disables attribute highlighting — every edge stays at `opacity 0.05` / `strokeWidth 1.5`.
- **Background** is driven by CSS tokens: `GRAPH_BACKGROUND` (`gap: 10`) passes
  `color: 'var(--graph-dot)'` and `bgColor: 'var(--graph-background)'` to `<Background>`
  (React Flow maps these to `--xy-background-pattern-color-props` /
  `--xy-background-color-props`). The values live in `src/index.css` (`:root` light,
  `.dark` dark), not inline.
- **`onPaneClick` clears the selection** (`onSelect(null)`), so clicking the background
  deselects the object/attribute.
- **Edge stacking**: nodes get `zIndex: 1`. Aggregated object edges get `zIndex: 0` (below the
  cards) while **attribute edges get `zIndex: 2` (topmost)**, so the per-row relation arrows
  are always visible. `elevateEdgesOnSelect={false}`. React Flow wraps each edge in its own
  positioned `<svg style={{ zIndex }}>`, so an edge zIndex above the node zIndex paints on top.
- **On selection only related edges stay**: with a selection, incoming + outgoing edges are
  bold (`strokeWidth 3` = double the base `1.5`) and every other edge is `opacity: 0`; without
  a selection all edges are normal. The arrowhead does **not** grow with the stroke:
  `markerEnd` uses `markerUnits: 'userSpaceOnUse'` with `width/height: 25` (double the default
  12.5).
- The graph container must have a real height: the Workspace grid uses `grid-rows-1`,
  `min-h-0` and `h-full` on its children, otherwise React Flow measures a zero-height
  container and renders nothing.

### `src/components/graph/EntityNode.jsx`
- Renders the card: a coloured header (drag grip + **namespace pill** + object name +
  **total-attribute badge**), the **object description** (wraps on several lines) just under
  the title, then a dashed root pseudo-group, then one bordered box per group.
- The namespace (when present) is a small rounded pill tinted with the object colour, in front
  of the object name.
- The total attribute count is a **bold white badge on the object colour** (no `attrs` label).
- Each group header shows the **group's attribute count**. **Optional attributes render in
  italic without bold** (`font-normal italic`), mandatory ones are `font-medium`.
- Every attribute row starts with a small icon chip. **A derived attribute (with an `origin`)
  shows a white `Sigma` on a pastel blue chip** (`bg-blue-400` / `text-white`); a plain one shows
  a `Pencil` (`text-zinc-400`) on a light grey chip (`bg-zinc-200`). The `example` is appended
  after the name in italic muted.
- **Selecting an attribute auto-reveals its origins**: `GraphView` computes `revealRefs` (the
  selected ref plus the `sourceRef`/`targetRef` of every attribute edge touching it) and passes
  it in `data.revealRefs`. `EntityNode` watches a sorted key of that set and, on change, expands
  every group containing a revealed attribute and un-collapses the root when needed — so the
  source rows of a formula become visible without manual expansion.
- **Groups and the root pseudo-group are collapsed by default** and expand via a chevron:
  `EntityNode` keeps an `expanded` `Set` (empty = all collapsed, so a new group starts
  collapsed) and a `rootCollapsed` flag initialised to `true`. The root header has **no
  label**, only the chevron and the count.
- The chevron has a **transparent background**: the group header applies the group tint to its
  container (chevron + selection button), so the chevron shares the group colour. Group and root
  headers use the same padding (`gap-1 px-1`, count with `pr-1`).
- **Groups have no connection handles** (they cannot be linked); only attribute rows mount
  handles. `buildAttributeEdges` ignores group origins and group sources.
- **Selected object/group titles use a darker tint** of the object colour
  (`withAlpha(color, 0.42)` / `0.34`) with **no shadow and no ring**; upstream/downstream
  highlighting keeps its sky/emerald ring.
- Selection and row/group refs use the node's **`qualifiedName`** (passed in `data`), not
  `model.name`; the title still displays the bare `model.name`.
- **No colour dots** before the object name or the attribute names; the header tint and the
  handle colours carry the object colour. The header shows a `GripVertical` icon as a drag
  affordance (the whole card is draggable).
- Every row uses a fixed grid `[16px_minmax(0,1fr)_auto_auto]` (icon, name, warning, type badge)
  and a fixed height, which keeps the cards visually homogeneous and makes the `objectHeight`
  estimate accurate. **Attribute names and type badges are `font-mono`**.
- Rows and group headers are buttons that select the element; `event.stopPropagation()`
  prevents the node-level object selection.
- In `attribute` mode each row and group header mounts a `target` handle on the left and a
  `source` handle on the right, with `id` = the element ref. The handle wrapper is
  `position: relative` so React Flow's `left: 0 / top: 50%` anchors to the row, not the card.
- In `aggregated` mode the handle pair is mounted **on the sides of the title**:
  `Position.Left` (target) and `Position.Right` (source) with `top: 16` (half of the 32px
  header), so object links attach at the title's vertical centre, not the card's.
- Row state classes: selected → `bg-primary/20 ring-primary`, upstream → sky, downstream →
  emerald, otherwise dimmed when a highlight is active.

### Editor forms
- **All edit fields are monospace `text-xs` in black**: the `.editor-fields` CSS rule in
  `index.css` (`@layer components`) targets `input`, `textarea` and `[role="combobox"]`
  descendants with `font-mono text-xs text-foreground`. The `Inspector` and `AttributesPanel`
  content wrappers carry the class. Only labels stay muted.
- **UI primitives are borderless with a soft fill**: `Input`, `Textarea` and the `SelectTrigger`
  drop the border, use `bg-transparent` / `bg-black/3` and a `focus-visible:ring-[1px]`. Inline
  edit rows (source, group, attribute creation) use a `rounded-md px-3 py-1 bg-black/3` wrapper.
- **Clickable cursor globally**: `@layer base` sets `cursor: pointer` on every enabled
  `button` / `[role="button"]`, so every clickable area of the side panel shows the pointer.
- **No Comment field anywhere.** `ObjectForm`, `GroupForm` and `AttributeForm` only expose
  name/description/type/origin; the `comment` model field is parsed and preserved on save but
  cannot be edited.
- **`GroupForm` has no Origin section** — a group's origin made no sense in the product.
  Group `origin` is read from files (and shown by `collectOrigins`) but the UI never creates one.
- **Every field is a label-left full-width `FieldRow`** (grid `[84px_1fr]`), in the attribute,
  group and object About panels.
- **`AttributeForm`** rows: `Group` (a bordered combobox with a `<datalist>` of the object's
  group names — free text: an existing name moves the attribute, empty moves it to the root, a
  **new name creates the group** then moves the attribute in; an `X` sends it back to the
  root), `Name`, `Type`, `Presence` (select with **lowercase** `mandatory` / `optional`),
  `Example` (italic input), then `Description` and the Origin block. No add/delete attribute
  button here.
- **Creating is always "type a name, validate"**: `ObjectForm` and `AttributesPanel` show a
  bordered field (empty, `placeholder="new group name"` / `"new attribute name"`) with a
  **green check** button; Enter or the check creates the group/attribute with that name
  (`addGroup(fileName, name)` / `addAttribute(fileName, groupIndex, name)`, unique name applied
  by the mutation) and selects it.
- **`GroupForm`**: only edits name/description. Its attribute list lives in the **Attributes**
  tab.
- **`ObjectForm`**: edits name/description, then the group creation field and the **groups
  list** (name + attribute count) with a red trash per row. Object deletion lives in the
  breadcrumb.
- **`TypeField` is a free text `Input` with a `<datalist>`** of `ATTRIBUTE_TYPES`: a type can
  be picked from the suggestions or typed manually.

### Workspace layout
- The main row is a **flex** row (not a fixed grid): `main` is `flex-1`, then a 1.5px
  `cursor-col-resize` **resizer** (mousedown starts a `window` mousemove drag, width clamped
  260–760) and the `<aside>` with an explicit `width: panelWidth`.
- A header button (`PanelRightClose`/`PanelRightOpen`) toggles the panel's **collapse**
  (`collapsed` hides the resizer and the aside).
- The header shows the **namespace bar**: `All` + one button per namespace derived from
  `entry.namespace`; the active one is passed to `GraphView` as `namespace`.

### Side panel
- `Breadcrumb` sits **above the tabs** in `Workspace`: `object › group › attribute`, each
  segment selects that level (navigation is by clicking a segment), plus, on the right, a **red
  trash button that deletes the current object** (with confirm). It resolves the entry from the
  store's `entries`; labels use the **qualified** object name (namespace included).
- The breadcrumb and the tab strip share a **very light grey** background (`bg-muted/50`); the
  tabs use the default shadcn variant so the **active tab is white** (`bg-background`).
- The tabs are `edit | attributes | formula | source` (`panelTab`), rendered with
  `TabsList variant="line"` (underline tab look, no pill/button background) and each trigger
  carries a lucide icon (`Info`, `List`, `Sigma`, `Code`). The first tab is labelled **`About`**.
- The store's `select` action **switches `panelTab` to `edit`** whenever an attribute or group
  is selected (object selection leaves the tab alone).
- Every panel is scrollable: `Inspector`, `FormulaPanel` and `AttributesPanel` wrap their
  content in a `ScrollArea`; `SourcePanel` fills its tab.
- `AttributesPanel` lists the attributes of the selected **object (root)** or **group** with a
  small left icon chip — a **white `Sigma` on `bg-blue-400`** when the attribute has an `origin`,
  a grey `Pencil` (`text-zinc-400`) otherwise — then the name, the type and a red trash. Rows are
  `font-mono`. A creation field + green check creates an attribute. Clicking a name selects the
  attribute. Optional attributes show the name in `font-normal italic`; the `example` is
  appended in italic muted.
- `FormulaPanel` shows one **clickable card** per derivation (clicking selects the attribute
  and jumps to the About tab). A card shows the attribute ref as a bold `<code>` (**without the
  current namespace** via `shortRef`), then `Sources` (each `from` ref prefixed `- `, unresolved
  struck through, namespace stripped) and `Formula`. **When there is no formula the Formula zone
  is not rendered** — a single `=` equality marker is shown instead. Object selection lists all
  origins, group selection lists its attributes' origins, attribute selection lists one card.
- `SourcePanel` is the last tab: it shows `serializeObject(entry.doc)` in `YamlEditor` **on a
  dark background** with an **Apply** button. Apply calls `applySource`; YAML errors are shown
  below the editor and the file is not touched. Radix unmounts inactive tab content, so the
  text is re-read from the CST each time the tab is opened.
- `YamlEditor` is a **dependency-free highlighter**: a highlighted `<pre>` sits behind a
  transparent `<textarea>` (same font/padding, `text-[11px]`); scroll is synced in
  `onScroll`. Keys are sky, values emerald, comments grey italic. `findComment` ignores `#`
  inside quotes.

### `src/components/editor/OriginForm.jsx` / `fields.jsx`
- Local draft state for `from` so an empty input row survives while typing (empty refs are
  filtered before being committed).
- The Origin block has a **`Sources` label** and a top border (`border-t-1 pt-4`), no dashed
  container.
- **Source editing**: a `bg-black/3` field (`placeholder="object.attribute"`, with the
  `origin-source-options` `<datalist>`) sits **above** the committed list and is validated with
  a **green check or Enter**. Committed sources are bordered blocks (`<code>` + **red trash
  inside the block**). On validation the ref is appended, the field clears, and a new block
  appears. Duplicates are ignored. The formula field has an empty placeholder.
- The **formula is a plain long `Textarea`** (free text, no autocomplete).
- The source datalist is built from `entries` (prop-drilled from `Inspector`).
- Both forms use the React "adjust state during render" pattern (`if (prop !== last) setState`)
  instead of `useEffect`, to avoid the `set-state-in-effect` lint warning.
- `BlurInput` commits on blur/Enter — used for renames so the file is renamed once, not per
  keystroke.

## 7. Conventions & gotchas

- **No TypeScript.** No `.ts`/`.tsx`, no `tsconfig.json`.
- **No code comments** unless explaining a non-obvious reason.
- **Tailwind v4**: there is **no `tailwind.config.js`**; tokens live in `src/index.css`
  under `:root` / `.dark` and are exposed via `@theme inline`.
- `src/components/ui/*` is generated by shadcn; lint warnings about
  `only-export-components` there are expected and accepted.
- The shadcn CLI sometimes emits `import { cn } from "cn"`. Fix it to
  `import { cn } from "@/lib/utils"` (and remove the stray `cn` npm package).
- Tests: model tests run in the `node` environment; component tests opt into jsdom with
  `// @vitest-environment jsdom` and rely on the polyfills in `src/test/setup.js`:
  - `ResizeObserver`, `matchMedia`, `DOMMatrixReadOnly` are required by React Flow;
  - `Element.getBoundingClientRect`, `HTMLElement.offsetWidth/offsetHeight` and
    `SVGElement.getBBox` are needed for React Flow to compute node dimensions, handle
    bounds and edge labels. Without them **no edge renders** in jsdom (`getDimensions`
    returns 0 and React Flow skips `handleBounds`), so the edge-mode test would silently
    pass on 0 edges.
- `npm run preview` is required to exercise the built app; the middleware is registered
  there too.

## 8. Commands

| Command | Effect |
| --- | --- |
| `npm run dev` | Dev server + `/api/objects` middleware. |
| `npm run build` | Production build into `dist/`. |
| `npm run preview` | Serve `dist/` + middleware. |
| `npm test` | Vitest run (model + component tests). |
| `npm run test:watch` | Vitest watch. |
| `npm run lint` | oxlint. |
| `npx shadcn@latest add <name>` | Add a shadcn/ui component as `.jsx`. |
