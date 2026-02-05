import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SW_DICTIONARY_ENTRY_TTL_MS,
  SW_ENTRY_TTL_MS,
  SW_INDEX_TTL_MS,
} from "../lib/cacheConstants";

const startMarker = "// __CACHE_CONSTANTS_START__";
const endMarker = "// __CACHE_CONSTANTS_END__";

async function main() {
  const swPath = path.join(process.cwd(), "public", "sw.js");
  const source = await readFile(swPath, "utf-8");
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("sw.js cache constants markers not found.");
  }

  const block = [
    startMarker,
    `const INDEX_TTL_MS = ${SW_INDEX_TTL_MS};`,
    `const ENTRY_TTL_MS = ${SW_ENTRY_TTL_MS};`,
    `const DICTIONARY_ENTRY_TTL_MS = ${SW_DICTIONARY_ENTRY_TTL_MS};`,
    endMarker,
  ].join("\n");

  const before = source.slice(0, startIndex);
  const after = source.slice(endIndex + endMarker.length);
  const next = `${before}${block}${after}`;

  if (next !== source) {
    await writeFile(swPath, next, "utf-8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
