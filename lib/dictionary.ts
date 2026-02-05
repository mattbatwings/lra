import { type DictionaryIndexEntry } from "./types";
import { slugifyName } from "./archive";

export function buildDictionarySlug(entry: Pick<DictionaryIndexEntry, "id" | "terms">) {
  const base = entry.id;
  const primary = entry.terms?.[0] ? slugifyName(entry.terms[0]) : "";
  if (!primary) return base;
  return `${base}-${primary}`;
}

export function getDictionaryIdFromSlug(slug: string) {
  const base = slug.split("-")[0];
  return base || "";
}

export function dictionarySlugMatchesEntry(slug: string, entry: Pick<DictionaryIndexEntry, "id" | "terms">) {
  const lower = slug.toLowerCase();
  const entrySlug = buildDictionarySlug(entry).toLowerCase();
  if (lower === entrySlug) return true;
  const base = getDictionaryIdFromSlug(lower);
  return base === entry.id.toLowerCase();
}

export function findDictionaryEntryBySlug(entries: DictionaryIndexEntry[], slug: string) {
  const lower = slug.toLowerCase();
  const direct = entries.find((entry) => entry.id.toLowerCase() === lower);
  if (direct) return direct;
  return entries.find((entry) => dictionarySlugMatchesEntry(lower, entry));
}
