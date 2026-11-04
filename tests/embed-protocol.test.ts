import assert from "node:assert/strict";
import test from "node:test";
import { absoluteHttpUrl, ATTACHMENT_KINDS, DEFAULT_EMBED_CONFIG, filtersSearch, parseConfig, parseFilters } from "../lib/embed/protocol";
import { embedAttachment } from "../lib/embed/attachments";
import { extractFiltersFromSearch } from "../lib/filtering";
import type { ArchiveListItem } from "../lib/archive";
import { AttachmentSource, AuthorType, type Attachment } from "../lib/types";

test("configuration replacements reset omitted fields without mutating defaults", () => {
  const config = parseConfig({ appearance: { theme: "dark", hideNavigation: true } });
  assert.equal(config.appearance.theme, "dark");
  assert.deepEqual(parseConfig({}), DEFAULT_EMBED_CONFIG);
  assert.equal(DEFAULT_EMBED_CONFIG.appearance.theme, "system");
});

test("replacement downloads require a matching registered action", () => {
  assert.throws(() => parseConfig({ download: { wdl: "replace" } }), /requires a matching action/);
  assert.equal(parseConfig({ actions: [{ id: "import", label: "Import", kinds: ["wdl"] }], download: { wdl: "replace" } }).download.wdl, "replace");
});

test("untrusted configuration rejects scripts, invalid types, ambiguous IDs and oversized lists", () => {
  for (const config of [
    { html: "<button>" }, { appearance: { hideFooter: "true" } }, { actionTimeoutMs: 0 },
    { actions: [{ id: "view-schematic", label: "Reserved", kinds: ["litematic"] }] },
    { actions: [{ id: "import", label: "Import", kinds: ["zip"] }] },
    { actions: Array.from({ length: 13 }, (_, i) => ({ id: String(i), label: "Import", kinds: ["wdl"] })) },
    { actions: [{ id: "same", label: "A", kinds: ["wdl"] }, { id: "same", label: "B", kinds: ["wdl"] }] },
  ]) assert.throws(() => parseConfig(config));
});

test("filter commands round-trip through the existing website URL parser", () => {
  const filters = parseFilters({ q: "hopper & storage", tags: ["Recommended"], excludeTags: ["Broken"], channels: ["US"], authors: ["A B"], tagMode: "OR", sort: "archivedOldest" });
  const parsed = extractFiltersFromSearch(new URLSearchParams(filtersSearch(filters)), ["archivedOldest"]);
  assert.equal(parsed.q, filters.q);
  assert.equal(parsed.tagState.Recommended, 1);
  assert.equal(parsed.tagState.Broken, -1);
  assert.deepEqual(parsed.selectedChannels, ["US"]);
  assert.deepEqual(parsed.selectedAuthors, ["A B"]);
  assert.equal(parsed.sortKey, "archivedOldest");
  assert.equal(parsed.tagMode, "OR");
});

test("filter inputs reject invalid enums and unbounded values", () => {
  for (const value of [{ q: 42 }, { tags: [null] }, { authors: ["comma,name"] }, { sort: "random" }, { query: "misspelling" }, { channels: Array(101).fill("US") }]) assert.throws(() => parseFilters(value));
  assert.equal(filtersSearch(parseFilters({})), "");
});

test("only HTTP(S) file URLs can be exposed as downloadable", () => {
  assert.equal(absoluteHttpUrl("javascript:alert(1)", "https://catalog.example"), null);
  assert.equal(absoluteHttpUrl("file:///tmp/a", "https://catalog.example"), null);
  assert.equal(absoluteHttpUrl("/files/a.litematic", "https://catalog.example"), "https://catalog.example/files/a.litematic");
});

const post = { channel: { path: "Tech" }, entry: { path: "US001" } } as ArchiveListItem;
const attachment: Attachment = {
  id: "a", name: "world.zip", url: "https://source.example/world", description: "", timestamp: 0,
  source: AttachmentSource.DirectUpload, author: { type: AuthorType.Unknown, username: "Author" },
  canDownload: true, contentType: "application/zip", path: "attachments/world.zip", size: 123,
};

test("file payloads resolve explicit, LFS and raw URLs consistently", () => {
  assert.match(embedAttachment(attachment, post).downloadUrl!, /^https:\/\/media\.githubusercontent\.com\/.*Tech\/US001\/attachments\/world\.zip$/);
  assert.match(embedAttachment({ ...attachment, name: "test.litematic", path: "attachments/test.litematic" }, post).downloadUrl!, /^https:\/\/raw\.githubusercontent\.com\//);
  assert.equal(embedAttachment({ ...attachment, path: undefined, downloadUrl: "https://files.example/file?x=1&y=2" }, post).downloadUrl, "https://files.example/file?x=1&y=2");
  assert.equal(embedAttachment({ ...attachment, canDownload: false }, post).downloadUrl, null);
  assert.equal(embedAttachment({ ...attachment, downloadUrl: "javascript:bad" }, post).canDownload, false);
});

test("ZIP files do not imply WDL support; parse errors are retained", () => {
  assert.equal(embedAttachment(attachment, post).kind, "other");
  const file = embedAttachment({ ...attachment, wdl: { version: "1.21", error: "Unknown region format" } }, post);
  assert.equal(file.kind, "wdl");
  assert.equal(file.wdl?.error, "Unknown region format");
  assert.equal(file.sizeBytes, 123);
});

test("every attachment kind can be targeted by actions and download policies", () => {
  for (const kind of ATTACHMENT_KINDS) {
    const config = parseConfig({ actions: [{ id: "import", label: "Import", kinds: [kind] }], download: { [kind]: "replace" } });
    assert.equal(config.download[kind], "replace");
    assert.deepEqual(config.actions[0].kinds, [kind]);
  }
  assert.throws(() => parseConfig({ download: { zip: "hide" } }));
});

test("attachments are classified by metadata, extension and content type", () => {
  const kindOf = (overrides: Partial<Attachment>) => embedAttachment({ ...attachment, ...overrides }, post).kind;
  assert.equal(kindOf({ name: "a.litematic", contentType: "" }), "litematic");
  assert.equal(kindOf({ name: "a.schem", contentType: "" }), "schematic");
  assert.equal(kindOf({ name: "a.nbt", contentType: "" }), "schematic");
  assert.equal(kindOf({ name: "a.mp4", contentType: "" }), "video");
  assert.equal(kindOf({ name: "a.png", contentType: "" }), "image");
  assert.equal(kindOf({ name: "a", contentType: "application/pdf" }), "pdf");
  assert.equal(kindOf({ name: "a.tsv", contentType: "" }), "csv");
  assert.equal(kindOf({ name: "watch", contentType: "", youtube: { title: "t", author_name: "a", author_url: "", thumbnail_url: "", thumbnail_width: 1, thumbnail_height: 1, width: 1, height: 1 } }), "youtube");
  const schematic = embedAttachment({ ...attachment, name: "a.schem", schematic: { version: "1.21" } }, post);
  assert.equal(schematic.schematic?.version, "1.21");
});
