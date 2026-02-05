import { getEntryArchivedAt, getEntryUpdatedAt, type IndexedDictionaryEntry, type SortKey } from "./types";
import { type ArchiveListItem } from "./archive";
import { unique } from "./utils/arrays";
import { normalize } from "./utils/strings";
import { getPostTagsNormalized } from "./utils/tags";

export type TagMode = "OR" | "AND";

export const parseListParam = (value: string | null) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []);
export const serializeListParam = (values: string[]) => values.filter(Boolean).join(",");

export const buildTagState = (includeTagsRaw: string[], excludeTagsRaw: string[]) => {
  const next: Record<string, -1 | 0 | 1> = {};
  includeTagsRaw.forEach((name) => {
    next[name] = 1;
  });
  excludeTagsRaw.forEach((name) => {
    next[name] = -1;
  });
  return next;
};

export const extractFiltersFromSearch = (sp: URLSearchParams, sortKeys: SortKey[]) => {
  const q = sp.get("q") ?? "";
  const sortParam = sp.get("sort") as SortKey | null;
  const sortKey = sortParam && sortKeys.includes(sortParam) ? sortParam : undefined;
  const tagMode: TagMode = sp.get("tagMode") === "OR" ? "OR" : "AND";
  const includeTagsRaw = parseListParam(sp.get("tags"));
  const excludeTagsRaw = parseListParam(sp.get("xtags"));
  const tagState = buildTagState(includeTagsRaw, excludeTagsRaw);
  const selectedChannels = parseListParam(sp.get("channels"));
  const selectedAuthors = parseListParam(sp.get("authors"));
  return { q, sortKey, tagMode, tagState, selectedChannels, selectedAuthors };
};

export function getPostAuthorsNormalized(p: ArchiveListItem): string[] {
  const entryAuthors = p.entry.authors;
  const normalized = unique([...entryAuthors]).map(normalize).filter(Boolean);
  return Array.from(new Set(normalized));
}

export const computeChannelCounts = (posts: ArchiveListItem[]) => {
  const map: Record<string, number> = {};
  posts.forEach((p) => {
    map[p.channel.code] = (map[p.channel.code] || 0) + 1;
  });
  return map;
};

export const computeTagCounts = (
  posts: ArchiveListItem[],
) => {
  const map: Record<string, number> = {};
  posts.forEach((p) => {
    getPostTagsNormalized(p).forEach((t) => {
      map[t] = (map[t] || 0) + 1;
    });
  });
  return map;
};

export function computeAuthorCounts(posts: ArchiveListItem[]) {
  const counts: Record<string, number> = {};
  posts.forEach((p) => {
    getPostAuthorsNormalized(p).forEach((author) => {
      counts[author] = (counts[author] || 0) + 1;
    });
  });
  return counts;
}

type FilterPostsParams = {
  q: string;
  includeTags: string[];
  excludeTags: string[];
  selectedChannels: string[];
  sortKey: SortKey;
  tagMode: TagMode;
  selectedAuthors: string[];
};

export const filterPosts = (posts: ArchiveListItem[], params: FilterPostsParams) => {
  const { q, includeTags, excludeTags, selectedChannels, sortKey, tagMode, selectedAuthors } = params;
  const trimmed = q.trim();
  let list = posts;

  if (selectedChannels.length) {
    const set = new Set(selectedChannels);
    list = list.filter((p) => set.has(p.channel.code) || set.has(p.channel.name));
  }

  if (includeTags.length || excludeTags.length) {
    list = list.filter((p) => {
      const postTags = getPostTagsNormalized(p);
      if (excludeTags.some((t) => postTags.includes(t))) return false;
      if (!includeTags.length) return true;
      if (tagMode === "OR") return includeTags.some((t) => postTags.includes(t));
      return includeTags.every((t) => postTags.includes(t));
    });
  }

  if (selectedAuthors.length) {
    const set = new Set(selectedAuthors.map(normalize));
    list = list.filter((p) => {
      const postAuthors = getPostAuthorsNormalized(p);
      if (!postAuthors.length) return false;
      return postAuthors.some((a) => set.has(a));
    });
  }

  if (trimmed) {
    const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter((p) => {
      const base = [p.entry.name, p.entry.codes[0], p.channel.code, p.channel.name].join(" ").toLowerCase();
      const extra = [
        p.entry.tags?.join(" ") || "",
        getPostAuthorsNormalized(p).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const hay = `${base} ${extra}`;
      return terms.every((t) => hay.includes(t));
    });
  }

  return list.slice().sort((a, b) => {
    if (sortKey === "newest") return (getEntryUpdatedAt(b.entry) ?? 0) - (getEntryUpdatedAt(a.entry) ?? 0);
    if (sortKey === "oldest") return (getEntryUpdatedAt(a.entry) ?? 0) - (getEntryUpdatedAt(b.entry) ?? 0);
    if (sortKey === "archived") return (getEntryArchivedAt(b.entry) ?? 0) - (getEntryArchivedAt(a.entry) ?? 0);
    if (sortKey === "archivedOldest") return (getEntryArchivedAt(a.entry) ?? 0) - (getEntryArchivedAt(b.entry) ?? 0);
    return a.entry.name.localeCompare(b.entry.name);
  });
};

export const filterDictionaryEntries = (dictionaryEntries: IndexedDictionaryEntry[], dictionaryQuery: string, sort: "az" | "updated" = "az") => {
  const term = dictionaryQuery.trim().toLowerCase();
  let list = dictionaryEntries;
  if (term) {
    list = list.filter((entry) => {
      const haystack = [entry.index.summary || "", ...(entry.index.terms || []), entry.data?.definition || ""].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }
  const sorted = [...list];
  if (sort === "updated") {
    sorted.sort((a, b) => (b.index.updatedAt ?? 0) - (a.index.updatedAt ?? 0));
  } else {
    sorted.sort((a, b) => {
      const aTerm = (a.index.terms?.[0] || a.index.id || "").toLowerCase();
      const bTerm = (b.index.terms?.[0] || b.index.id || "").toLowerCase();
      return aTerm.localeCompare(bTerm);
    });
  }
  return sorted;
};
