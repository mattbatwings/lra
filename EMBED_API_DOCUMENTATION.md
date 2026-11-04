# Logical Redstone Archive iframe API

Protocol version: **1**. The API runs entirely in the browser and works with the
site's static export. There is no API server, API key, or build-time list of parent
origins. Ordinary standalone browsing keeps its existing behavior.

Every message carries a namespace, set by `embedNamespace` in `lib/siteConfig.ts`
(`"logical-redstone-archive"` by default). The parent must use the same value: pass it as
the helper's `namespace` option, or change the default at the top of
`public/embed-api.js` when you copy it. The examples below use the default.

## Quick start

Copy `public/embed-api.js` into your simulator's frontend. TypeScript projects
should also copy `public/embed-api.d.ts` beside it. The JavaScript file is an ES
module with no dependencies. Serve it from your own origin, or bundle it with
your application; importing it directly from another origin requires that host
to permit module requests with CORS.

```html
<iframe
  id="archive"
  src="https://mattbatwings.github.io/lra/archives/"
  title="Logical Redstone Archive"
  style="width: 100%; height: 85vh; border: 0"
></iframe>

<script type="module">
  import { createCatalogEmbed } from "./embed-api.js";

  const catalog = createCatalogEmbed(
    document.querySelector("#archive"),
    {
      config: {
        actions: [
          {
            id: "import-schematic",
            label: "Load in simulator",
            kinds: ["litematic"]
          },
          {
            id: "import-world",
            label: "Import world",
            kinds: ["wdl"]
          }
        ],
        download: { litematic: "replace", wdl: "replace" },
        viewSchematic: { mode: "parent", label: "View in simulator" },
        appearance: {
          compact: true,
          hideNavigation: true,
          hideFooter: true,
          theme: "dark"
        },
        actionTimeoutMs: 60000
      }
    }
  );

  catalog.on("action", (event) => {
    // Implement this function in your simulator; see the example below.
    handleCatalogAction(event).catch(console.error);
  });
  catalog.on("postChanged", ({ post, attachments, loading }) => {
    console.log("Current entry:", post, attachments, loading);
  });
  catalog.on("error", console.error);

  await catalog.ready;
  console.log(await catalog.getState());

  async function handleCatalogAction(event) {
    try {
      await catalog.reportAction(event.requestId, "pending", "Fetching file…");
      const response = await fetch(event.attachment.downloadUrl);
      if (!response.ok) throw new Error(`File request failed: ${response.status}`);
      const bytes = await response.arrayBuffer();

      // Your own simulator functions; the catalog does not implement these.
      if (event.actionId === "view-schematic") {
        await simulator.previewSchematic(bytes, event.attachment.name);
      } else if (event.actionId === "import-schematic") {
        await simulator.importSchematic(bytes, event.attachment.name);
      } else if (event.actionId === "import-world") {
        await simulator.importWorld(bytes, event.attachment.name);
      }

      await catalog.reportAction(event.requestId, "success", "Loaded.");
    } catch (error) {
      // Reporting can itself reject if the iframe reloaded or the action expired.
      await catalog.reportAction(
        event.requestId,
        "failure",
        (error instanceof Error ? error.message : "Import failed.").slice(0, 500)
      );
    }
  }

  // On component teardown, call catalog.destroy() before removing the iframe.
</script>
```

Replace the catalog URL if you host another deployment. Local development works
with different ports, for example simulator `http://localhost:3000` and catalog
`http://localhost:3001`. The SDK derives the expected catalog origin from the
iframe's `src`; use `origin` explicitly when necessary, such as after a redirect.

No `embed=1` query parameter is needed. The bridge activates only when the actual
parent window connects. The iframe can start on an archive list or a direct post
URL. The SDK should be created once per iframe element.

## Configuration

`configure(config)` replaces the **entire configuration**. Omitted fields reset
to defaults; it is not a patch operation. Validation is atomic: a rejected update
leaves the previous configuration active. Unknown configuration keys are rejected.
The SDK retains successful configurations and reapplies them after document loads.

| Field | Default | Meaning |
| --- | --- | --- |
| `actions` | `[]` | Custom buttons for matching attachment kinds. |
| `download.<kind>` | `"keep"` | Per attachment kind: `"keep"`, `"replace"`, or `"hide"`. |
| `viewSchematic.mode` | `"builtin"` | `"builtin"`, `"parent"`, or `"hidden"`; applies to `litematic` and `schematic` attachments. |
| `viewSchematic.label` | `"View Schematic"` | Plain-text button label. |
| `appearance.compact` | `false` | Reduce post spacing and main content padding. |
| `appearance.hideNavigation` | `false` | Hide branding/site links and post navigation; retain archive search/filter controls. |
| `appearance.hideFooter` | `false` | Hide the site footer. |
| `appearance.theme` | `"system"` | `"light"`, `"dark"`, or the browser's color-scheme preference. |
| `actionTimeoutMs` | `60000` | Deadline for each custom/viewer action, in milliseconds. |

An action is `{ id, label, kinds }`:

- At most 12 actions; IDs must be unique, 1–64 characters, and contain only
  letters, digits, `_`, or `-`. `view-schematic` is reserved.
- Labels are plain text, 1–80 characters. No HTML, callbacks, or CSS are accepted.
- `kinds` is a nonempty list of attachment kinds (see below). List every kind
  the action should appear on.
- Actions appear in registration order on main post and comment attachment cards.
  The built-in/viewer button remains before the custom actions.
- Custom actions emit events and never navigate to a file or initiate a download.
  They are disabled if a directly downloadable HTTP(S) URL is unavailable, except
  on `youtube` attachments, which have no file; use `sourceUrl` for those.

Every attachment has exactly one kind, checked in this order:

| Kind | Matches |
| --- | --- |
| `youtube` | YouTube links. |
| `litematic` | Litematica metadata or a `.litematic` file. |
| `schematic` | Schematic metadata or a `.schem`, `.schematic`, or `.nbt` file. |
| `wdl` | World downloads with parsed WDL metadata. A ZIP filename alone is not enough. |
| `video` | `video/*` content or `.mp4`, `.webm`, `.m3u8`, `.mpd` files. |
| `image` | `image/*` content or common image extensions. |
| `pdf` | PDF content or `.pdf` files. |
| `csv` | CSV content or `.csv`, `.tsv` files. |
| `other` | Everything else. |

Download policies (`download.<kind>`) work the same way for every kind:

- `"keep"` leaves the ordinary Download/Open link alongside custom actions.
  `"replace"` removes it and requires at least one matching action.
  `"hide"` removes it without requiring a replacement.
- Download policies affect matching attachment cards, including their Open link
  when a direct download is unavailable. They do not intercept inline Markdown
  links or change image, PDF, spreadsheet, or video behavior.
- A parsing error in Litematic/schematic/WDL metadata is passed through. It does not by
  itself disable an action; your simulator decides which formats it supports.
- `actionTimeoutMs` must be an integer from 1000 through 300000.

With `viewSchematic.mode: "parent"`, clicking the viewer button emits action
`view-schematic` and does not open the catalog's renderer iframe. With `"builtin"`,
the existing renderer opens. With `"hidden"`, the viewer button is absent.
This setting applies to `litematic` and `schematic` attachments; other kinds have
no built-in schematic viewer.
Changing configuration closes any existing built-in schematic overlay and cancels
pending parent actions in the catalog UI.

## Parent helper

`createCatalogEmbed(iframe, options)` returns a client. Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `origin` | Origin of `iframe.src` | Exact catalog origin, including scheme and port. |
| `namespace` | `"logical-redstone-archive"` | Message namespace; must match the site's `embedNamespace`. |
| `config` | `{}` | Initial configuration and configuration to reapply after reloads. |
| `timeoutMs` | `15000` | Timeout for each parent command. |
| `connectTimeoutMs` | `15000` | Timeout for connecting to each document. |

Commands return promises and reject with `CatalogEmbedError`, which has `code`
and `message` fields. Create the iframe with its intended `src` before creating
the helper. Register event listeners immediately; commands wait for initialization.

| Member | Behavior |
| --- | --- |
| `ready` | Promise for the current connection after its configuration is acknowledged. Read this property again after a reload to wait for the new connection. |
| `configure(config)` | Replace configuration; resolves with normalized configuration including defaults. |
| `getState()` | Read the current entry, its main attachments, loading flag, URL, and URL-committed filters. Does not fetch file contents. |
| `openPost({ id })` | Navigate to a post by its string ID. |
| `openPost({ code })` | Navigate by primary or alternate post code; matching is case-insensitive. Supply exactly one selector. |
| `showArchive(filters = {})` | Show the archive list with the supplied filter state. No argument clears filters. |
| `setFilters(filters)` | Replace filter state and show the archive list. Omitted fields reset to defaults. |
| `reportAction(requestId, status, message?)` | Update a clicked action; `status` is `"pending"`, `"success"`, or `"failure"`. |
| `on(event, handler)` | Subscribe; returns an unsubscribe function. |
| `reconnect()` | Restart the handshake, for example after a connection timeout. |
| `destroy()` | Remove listeners/timers, reject outstanding requests, and send a best-effort disconnect that restores standalone UI. Does not remove the iframe. |

Navigation commands resolve with `{ accepted: true, href }`; filter commands also
return normalized `filters`. Acceptance means navigation was requested, not that
post data has finished loading. Observe `postChanged` or call `getState()` for
loading state. A newer navigation supersedes an older `openPost` still loading
the index. A parent command timeout does not abort an already accepted operation.

### Filters

```ts
await catalog.setFilters({
  q: "hopper storage",
  channels: ["US"],
  authors: ["Author name"],
  tags: ["Recommended"],
  excludeTags: ["Broken"],
  tagMode: "AND",
  sort: "newest"
});
await catalog.openPost({ code: "US001" });
```

All filter fields are optional. Defaults: empty query/lists, `tagMode: "AND"`,
`sort: "newest"`. Sort options: `newest`, `oldest`, `archived`, `archivedOldest`,
`az`. Queries may contain up to 1000 characters; each list may contain up to 100
nonempty strings, each at most 200 characters. Duplicate list values are removed.
Existing website filtering rules still apply: channel names can resolve to codes,
invalid channels are removed, and tags unavailable in selected channels are removed.
Excluded tags take precedence over included tags with the same name. Filter URLs
use comma-separated lists, so individual list values must not contain commas.

Filters in `getState()` describe the current URL, not uncommitted typing or a
remembered list hidden behind a post. Opening a post changes the URL to its post
route. No automatic synchronization with the parent window's address bar occurs.

## Events and data

The helper exposes `connected`, `postChanged`, `action`, and `error` events.
`connected` fires after each successful initialization, including reloads.
The helper also sends subscribers an initial `postChanged` snapshot after
connecting. Further snapshots may repeat; consumers should tolerate duplicates.

`postChanged` contains:

```ts
{
  namespace: "logical-redstone-archive",
  version: 1,
  sessionId: "document-session-id",
  type: "postChanged",
  post: { id: "...", code: "US001", title: "...", url: "https://.../archives/.../" },
  attachments: [ /* main post attachment descriptors */ ],
  loading: false
}
```

`post` is `null` outside a post or while transitioning; `attachments` is then
empty. `loading` reflects initial post data availability, not background refreshes,
comment loading, or file loading. Comment attachment descriptors are delivered
when their actions are clicked, rather than in the main attachment list.
Post URLs are canonical URLs from site configuration. `getState().url` is the
actual iframe URL, including development hosts and query parameters.

`action` contains:

```ts
{
  namespace: "logical-redstone-archive",
  version: 1,
  sessionId: "document-session-id",
  type: "action",
  requestId: "unique-click-id",
  actionId: "import-schematic", // or the reserved "view-schematic"
  post: { id: "...", code: "US001", title: "...", url: "https://..." },
  attachment: {
    id: "...",
    kind: "litematic", // any attachment kind; see the table above
    name: "example.litematic",
    downloadUrl: "https://raw.githubusercontent.com/...",
    sourceUrl: "https://cdn.discordapp.com/...",
    canDownload: true,
    contentType: "application/octet-stream",
    sizeBytes: 12345, // optional
    litematic: { version: "...", size: "...", error: "..." }, // optional
    schematic: { version: "...", size: "...", error: "..." }, // optional
    wdl: { version: "...", error: "..." } // optional
  },
  context: { location: "post" } // or { location: "comment", commentId: "..." }
}
```

IDs are strings. Treat `(post.id, context.location, context.commentId,
attachment.id)` as attachment identity. MIME types and optional metadata may be
unknown or absent. The Litematic `size` field is the archive's descriptive string,
not a guaranteed structured dimension tuple.

`downloadUrl` uses the shared resolver: explicit `downloadUrl`, then an archived
GitHub raw/LFS path, then the original URL. It is absolute and HTTP(S), or `null`
when the attachment cannot be downloaded. `sourceUrl` is the original provenance
link and may be expired or lead to an HTML page. Prefer `downloadUrl` for imports.

The clicked button is disabled while pending. Status feedback appears in a tooltip
above the button on hover or keyboard focus and never affects button layout.
Escape dismisses the tooltip; status updates are also announced to screen readers.
Reporting `pending` updates its
plain-text status (up to 500 characters) but does not extend its original deadline.
`success` or `failure` completes the action, displays feedback, and permits another
click. No response before the deadline displays a timeout failure. There is no
automatic download/viewer fallback and no automatic retry of imports.

Reconfiguration and disconnect cancel pending actions. A late `reportAction`
rejects with `NOT_FOUND`; outstanding commands reject when the iframe reloads.
An import your simulator has already started is not cancelled by the catalog:
manage your own cancellation and use the event's session/request IDs to avoid
applying stale work to a new document.

## Raw postMessage protocol

Using the helper is optional. For another language/framework, implement the same
handshake. Install the parent's message listener before sending `connect`, and
retry connecting until the child has mounted its listener. The provided helper
retries every 250 ms until its connection deadline.

1. Parent sends `{ namespace: "logical-redstone-archive", version: 1, type: "connect" }`
   to `iframe.contentWindow` with the catalog's exact origin.
2. Child replies `ready` with `sessionId` and `capabilities`.
3. Parent sends `configure` with the returned session ID and waits for a response.
4. Parent sends commands and handles child events. Every command needs a unique,
   nonempty `requestId` of at most 128 characters.

```ts
iframe.contentWindow.postMessage({
  namespace: "logical-redstone-archive",
  version: 1,
  sessionId,
  type: "configure",
  requestId: "configure-1",
  payload: { viewSchematic: { mode: "parent" } }
}, "https://mattbatwings.github.io");
```

Supported command types and payloads:

| Type | Payload |
| --- | --- |
| `configure` | Configuration object. |
| `getState` | None. |
| `openPost` | `{ id: string }` or `{ code: string }`. |
| `showArchive` | Filter object, or omit for defaults. |
| `setFilters` | Filter object. |
| `actionResult` | `{ actionRequestId: string, status: "pending" \| "success" \| "failure", message?: string }`. |
| `disconnect` | None; restore defaults and release the parent connection. |

Success replies use `{ ...envelope, type: "response", requestId, result }`.
Errors use `{ ...envelope, type: "error", requestId, code, message }`.
`actionResult` and `disconnect` return `null`. Action events' `requestId` values
identify clicks; report them in `payload.actionRequestId`, with a separate
`requestId` for the reporting command.

Capabilities in v1: `attachmentActions`, `viewSchematic`, `actionResults`,
`navigation`, `state`, `filters`, `appearance`.

| Error code | Meaning |
| --- | --- |
| `INVALID_ARGUMENT` | Invalid configuration, payload, or selector. |
| `UNKNOWN_COMMAND` | Command type is unsupported. |
| `UNSUPPORTED_VERSION` | Connect requested another protocol version. |
| `NOT_FOUND` | Post is absent or clicked action is no longer pending. |
| `LOAD_FAILED` | Archive index could not be loaded. |
| `SUPERSEDED` | A newer navigation replaced an index lookup. |
| `INTERNAL_ERROR` | Another command failure. |
| `TIMEOUT` | Helper connection/command deadline expired. |
| `RECONNECTED` | Helper rejected work belonging to an earlier connection. |
| `DESTROYED` | Helper was disposed. |

Wrong-source, wrong-origin, wrong-session, and malformed-envelope traffic is
ignored. Commands without a valid request ID are ignored. An unsupported-version
connect receives an error before a session is established. Each document gets a
new session; client-side navigation retains the existing session. Repeat connects
from the established parent return `ready` without clearing configuration.

## Browser and hosting requirements

- Parent and catalog must have HTTP(S) origins. Opaque/null origins, including
  `file:` parents and sandboxed frames without `allow-same-origin`, are unsupported.
- If using `sandbox`, allow scripts and same-origin behavior. Other permissions
  such as downloads/popups depend on which built-in features you retain.
- Both ends verify the exact origin and window reference. The child accepts its
  actual immediate parent and locks that origin for the connection; public catalog
  metadata is available to any HTTP(S) parent that embeds it. This is not an
  authentication boundary or access to private simulator data. For restricted
  embedding, configure `Content-Security-Policy: frame-ancestors` at your host.
- The parent's CSP must allow the catalog in `frame-src`; the catalog's response
  headers must allow embedding. This implementation does not change hosting headers.
- `postMessage` delivers metadata independently of file CORS. A parent-side
  `fetch(downloadUrl)` still requires the file host to permit your simulator origin.
  Redirects, missing/expired files, and unsupported formats remain parent-side errors.
  No proxy is included, and file contents are not transferred by the bridge.
- The catalog's built-in viewers/media can contain nested iframes. Their messages
  are rejected because they are not the immediate parent window.
- If your simulator requires cross-origin isolation, verify its COEP/COOP policy
  permits this iframe. The API does not configure those response headers.

Related browser references: [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage),
[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), and
[frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

## Scope and verification

V1 does not accept arbitrary parent HTML/CSS/scripts, transfer file bytes, parse
or convert schematics/worlds, intercept every link, upload files, edit the catalog,
or implement simulator operations. `.schem`/`.schematic` and arbitrary ZIP files
are not inferred to be supported schematic/WDL types.

Run `npm run test:embed` for protocol validation, download URL resolution, filter
serialization, and parent-helper connection/reload/timeout tests. Type-check with
`npx tsc --noEmit`; use `npm run lint` and `npm run build` for repository checks.
