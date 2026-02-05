import { extractFiltersFromSearch, serializeListParam } from "./filtering";
import { type SortKey } from "./types";

type ArchiveFilters = {
  q: string;
  committedQ: string;
  tagMode: "OR" | "AND";
  tagState: Record<string, -1 | 0 | 1>;
  selectedChannels: string[];
  selectedAuthors: string[];
  sortKey: SortKey;
  scrollY?: number;
};

type DictionaryState = {
  query: string;
  committedQuery: string;
  sort: "az" | "updated";
  slug: string | null;
};

export type ArchiveHistoryState = {
  archiveListHref?: string;
  lastPostCode?: string;
  lastDictionaryId?: string;
  backCount?: number;
  lastBackCount?: number;
};

const ARCHIVE_SORTS: SortKey[] = ["newest", "oldest", "archived", "archivedOldest", "az"];

const TEMP_STATE_STORE_KEY = "temp-archive-history-state";
const TEMP_STATE_TTL_MS = 5 * 1000; // 5 seconds

type TempHistoryStateEntry = {
  timestamp: number;
  state: ArchiveHistoryState;
  href: string;
}

export function saveTempHistoryState(state: ArchiveHistoryState, href: string) {
  const entry: TempHistoryStateEntry = {
    timestamp: Date.now(),
    state,
    href,
  };
  sessionStorage.setItem(TEMP_STATE_STORE_KEY, JSON.stringify(entry));
}

export function getTempHistoryState(): ArchiveHistoryState | null {
  const tempState = sessionStorage.getItem(TEMP_STATE_STORE_KEY);
  if (tempState) {
    try {
      const parsed = JSON.parse(tempState) as TempHistoryStateEntry;
      const href = window.location.href;
      if (href !== parsed.href) {
        sessionStorage.removeItem(TEMP_STATE_STORE_KEY);
        return null;
      }

      if (Date.now() - parsed.timestamp > TEMP_STATE_TTL_MS) {
        sessionStorage.removeItem(TEMP_STATE_STORE_KEY);
        return null;
      }
      return parsed.state;
    } catch {
      // ignore
    }
    sessionStorage.removeItem(TEMP_STATE_STORE_KEY);
  }
  return null;
}

export function applyTempHistoryState() {
  const tempState = getTempHistoryState();
  if (tempState) {
    const nextState = buildHistoryState({
      ...getHistoryState(),
      ...tempState,
    });
    window.history.replaceState(nextState, "", window.location.href);
    sessionStorage.removeItem(TEMP_STATE_STORE_KEY);
  }
}

export function buildHistoryState({
  archiveListHref, lastPostCode, lastDictionaryId, backCount, lastBackCount
}: ArchiveHistoryState): ArchiveHistoryState {
  if (typeof window === "undefined") return { archiveListHref, lastPostCode, lastDictionaryId, backCount, lastBackCount };
  const currentState = window.history.state;
  return (currentState && typeof currentState === "object")
    ? { ...(currentState as Record<string, unknown>), archiveListHref, lastPostCode, lastDictionaryId, backCount, lastBackCount }
    : { archiveListHref, lastPostCode, lastDictionaryId, backCount, lastBackCount };
};


export function getHistoryState(): ArchiveHistoryState {
  if (typeof window === "undefined") {
    return {};
  }
  const currentState = window.history.state;
  return (currentState && typeof currentState === "object")
    ? (currentState as ArchiveHistoryState)
    : {};
}

export function getArchiveFiltersFromUrl(): ArchiveFilters {
  if (typeof window === "undefined") {
    return {
      q: "",
      committedQ: "",
      tagMode: "AND",
      tagState: {},
      selectedChannels: [],
      selectedAuthors: [],
      sortKey: "newest",
    };
  }
  const sp = new URLSearchParams(window.location.search);
  const parsed = extractFiltersFromSearch(sp, ARCHIVE_SORTS);
  const q = parsed.q || "";
  return {
    q,
    committedQ: q,
    tagMode: parsed.tagMode,
    tagState: parsed.tagState || {},
    selectedChannels: parsed.selectedChannels || [],
    selectedAuthors: parsed.selectedAuthors || [],
    sortKey: parsed.sortKey || "newest",
  };
}

const buildArchiveFiltersHref = (filters: ArchiveFilters, pathname?: string) => {
  if (typeof window === "undefined") return null;
  const include = Object.keys(filters.tagState).filter((k) => filters.tagState[k] === 1);
  const exclude = Object.keys(filters.tagState).filter((k) => filters.tagState[k] === -1);
  const sp = new URLSearchParams();
  if (filters.committedQ.trim()) sp.set("q", filters.committedQ.trim());
  if (filters.sortKey !== "newest") sp.set("sort", filters.sortKey);
  if (filters.tagMode === "OR") sp.set("tagMode", "OR");
  if (include.length) sp.set("tags", serializeListParam(include));
  if (exclude.length) sp.set("xtags", serializeListParam(exclude));
  if (filters.selectedChannels.length) sp.set("channels", serializeListParam(filters.selectedChannels));
  if (filters.selectedAuthors.length) sp.set("authors", serializeListParam(filters.selectedAuthors));

  const query = sp.toString();
  const currentPathname = pathname ?? window.location.pathname;
  const next = query ? `${currentPathname}?${query}` : currentPathname;
  const current = `${currentPathname}${window.location.search}`;
  return { next, current };
};


export function replaceArchiveFiltersInHistory(filters: ArchiveFilters, pathname?: string) {
  const nextHref = buildArchiveFiltersHref(filters, pathname);
  if (!nextHref) return;
  if (nextHref.next === nextHref.current) return;
  const currentState = window.history.state;
  window.history.replaceState(currentState, "", nextHref.next);
}

export function readArchiveSession(): ArchiveFilters | null {
  if (typeof window === "undefined") return null;
  const saved = sessionStorage.getItem("archive-filters");
  if (!saved) return null;
  try {
    return JSON.parse(saved) as ArchiveFilters;
  } catch {
    return null;
  } finally {
    sessionStorage.removeItem("archive-filters");
  }
}

export function writeArchiveSession(filters: ArchiveFilters) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("archive-filters", JSON.stringify(filters));
}

export function readDictionarySession(): DictionaryState | null {
  if (typeof window === "undefined") return null;
  const nav = performance?.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === "reload") return null;
  const saved = sessionStorage.getItem("dictionary-state");
  if (!saved) return null;
  try {
    return JSON.parse(saved) as DictionaryState;
  } catch {
    return null;
  } finally {
    sessionStorage.removeItem("dictionary-state");
  }
}

export function writeDictionarySession(state: DictionaryState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("dictionary-state", JSON.stringify(state));
}
