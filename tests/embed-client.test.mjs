import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// Load the distributed browser module as ESM even under the TS runner's CJS hook.
const source = await readFile(new URL("../public/embed-api.js", import.meta.url));
const { createCatalogEmbed } = await import(`data:text/javascript;base64,${source.toString("base64")}`);

function target() {
  const events = new Map();
  return {
    addEventListener(type, handler) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(handler); },
    removeEventListener(type, handler) { events.get(type)?.delete(handler); },
    emit(type, data) { for (const handler of events.get(type) ?? []) handler(data); },
  };
}
function harness(t, config = {}, options = {}) {
  const originalWindow = globalThis.window;
  const host = target();
  host.location = { href: "https://simulator.example/" };
  globalThis.window = host;
  const iframe = { ...target(), tagName: "IFRAME", src: "https://catalog.example/archives/" };
  const messages = [];
  let session = "first-session";
  let answer = true;
  const receive = (data, overrides = {}) => host.emit("message", { origin: "https://catalog.example", source: iframe.contentWindow, data: { namespace: messages[0]?.namespace, version: 1, sessionId: session, ...data }, ...overrides });
  iframe.contentWindow = { postMessage(message, origin) {
    messages.push({ ...message, targetOrigin: origin });
    queueMicrotask(() => {
      if (message.type === "connect") receive({ type: "ready", capabilities: ["state"] });
      else if (answer) receive({ type: "response", requestId: message.requestId, result: message.type === "getState" ? { post: null, attachments: [] } : message.payload });
    });
  } };
  const client = createCatalogEmbed(iframe, { config, timeoutMs: 50, connectTimeoutMs: 1000, ...options });
  t.after(() => { client.destroy(); globalThis.window = originalWindow; });
  return { client, iframe, messages, receive, setSession(value) { session = value; }, stopAnswers() { answer = false; } };
}

test("client handshakes, applies configuration, and uses the exact target origin", async (t) => {
  const h = harness(t, { appearance: { theme: "dark" } });
  await h.client.ready;
  assert.equal(h.messages[0].type, "connect");
  assert.equal(h.messages[1].type, "configure");
  assert.equal(h.messages[1].payload.appearance.theme, "dark");
  assert.ok(h.messages.every((message) => message.targetOrigin === "https://catalog.example"));
});

test("client ignores wrong windows, origins, and stale sessions", async (t) => {
  const h = harness(t);
  const actions = [];
  h.client.on("action", (action) => actions.push(action));
  await h.client.ready;
  h.receive({ type: "action" }, { source: {} });
  h.receive({ type: "action" }, { origin: "https://attacker.example" });
  h.receive({ type: "action", sessionId: "stale" });
  assert.equal(actions.length, 0);
  h.receive({ type: "action", actionId: "import" });
  assert.equal(actions.length, 1);
});

test("document reload reconnects and reapplies the last successful configuration", async (t) => {
  const h = harness(t);
  await h.client.ready;
  await h.client.configure({ appearance: { compact: true } });
  h.setSession("second-session");
  h.iframe.emit("load");
  const ready = await h.client.ready;
  assert.equal(ready.sessionId, "second-session");
  const configurations = h.messages.filter((message) => message.type === "configure");
  assert.equal(configurations.at(-1).payload.appearance.compact, true);
});

test("reload rejects outstanding commands instead of matching them to a new document", async (t) => {
  const h = harness(t);
  await h.client.ready;
  h.stopAnswers();
  const request = h.client.openPost({ code: "US001" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const rejected = assert.rejects(request, (error) => error.code === "RECONNECTED");
  h.iframe.emit("load");
  await rejected;
});

test("commands time out and destroy releases waiting callers", async (t) => {
  const h = harness(t);
  await h.client.ready;
  h.stopAnswers();
  await assert.rejects(h.client.openPost({ code: "US001" }), (error) => error.code === "TIMEOUT");
  const pending = h.client.getState();
  const rejected = assert.rejects(pending, (error) => error.code === "DESTROYED");
  h.client.destroy();
  await rejected;
  await assert.rejects(h.client.getState(), (error) => error.code === "DESTROYED");
});

test("namespace option scopes every message to that site", async (t) => {
  const h = harness(t, {}, { namespace: "custom-archive" });
  await h.client.ready;
  assert.ok(h.messages.every((message) => message.namespace === "custom-archive"));
  let changed = 0;
  h.client.on("postChanged", () => { changed += 1; });
  h.receive({ type: "postChanged", post: null, attachments: [], loading: false, namespace: "other-site" });
  assert.equal(changed, 0);
  h.receive({ type: "postChanged", post: null, attachments: [], loading: false });
  assert.equal(changed, 1);
});
