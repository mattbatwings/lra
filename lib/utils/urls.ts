import { siteConfig } from "@/lib/siteConfig";

type ArchiveSlugInfo = {
  slug: string | null;
  isArchiveRoot: boolean;
};

type DictionarySlugInfo = {
  slug: string | null;
  isDictionaryRoot: boolean;
};

type DictionaryUrlOptions = {
  slug?: string | null;
  q?: string;
  sort?: "az" | "updated";
};

export function getArchiveSlugInfo(url: URL, basePath: string = siteConfig.basePath || ""): ArchiveSlugInfo {
  const rawPath = url.pathname;
  const normalizedPath = basePath && rawPath.startsWith(basePath) ? rawPath.slice(basePath.length) : rawPath;
  if (!normalizedPath.startsWith("/archives/")) {
    return { slug: null, isArchiveRoot: false };
  }
  const slugSegment = normalizedPath.replace("/archives/", "").replace(/\/+$/, "");
  if (!slugSegment) {
    return { slug: null, isArchiveRoot: true };
  }
  try {
    return { slug: decodeURIComponent(slugSegment), isArchiveRoot: false };
  } catch {
    return { slug: slugSegment, isArchiveRoot: false };
  }
}

export function getURLFromMouseEvent(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>): URL | null {
  const target = event.currentTarget;
  const href = target.getAttribute("href");
  if (!href) return null;
  try {
    return new URL(href, window.location.href);
  } catch {
    return null;
  }
}

export function getDictionarySlugInfo(url: URL, basePath: string = siteConfig.basePath || ""): DictionarySlugInfo {
  const rawPath = url.pathname;
  const normalizedPath = basePath && rawPath.startsWith(basePath) ? rawPath.slice(basePath.length) : rawPath;
  if (!normalizedPath.startsWith("/dictionary/")) {
    return { slug: null, isDictionaryRoot: false };
  }
  const slugSegment = normalizedPath.replace("/dictionary/", "").replace(/\/+$/, "");
  if (!slugSegment) {
    return { slug: null, isDictionaryRoot: true };
  }
  try {
    return { slug: decodeURIComponent(slugSegment), isDictionaryRoot: false };
  } catch {
    return { slug: slugSegment, isDictionaryRoot: false };
  }
}

export function buildDictionaryUrl(
  { slug = null, q = "", sort = "az" }: DictionaryUrlOptions,
  basePath: string = siteConfig.basePath || "",
) {
  const trimmedQuery = q.trim();
  const sp = new URLSearchParams();
  if (trimmedQuery) sp.set("q", trimmedQuery);
  if (sort !== "az") sp.set("sort", sort);
  const base = slug ? `/dictionary/${encodeURIComponent(slug)}` : "/dictionary";
  const queryString = sp.toString();
  const nextPath = queryString ? `${base}?${queryString}` : base;
  if (!basePath) return nextPath;
  return nextPath.startsWith(basePath) ? nextPath : `${basePath}${nextPath}`;
}
