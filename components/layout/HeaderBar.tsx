'use client';

import Image from "next/image";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/utils/classNames";
import { prefetchDictionaryIndex, prefetchIndexAndLatestPosts } from "@/lib/archive";
import { ForesightPrefetchLink } from "../ui/ForesightPrefetchLink";
import { siteConfig } from "@/lib/siteConfig";

type HeaderSearchFilters = {
  q: string;
  setQ(val: string): void;
  commitSearch(): void;
};

type HeaderSortFilters<TSort extends string> = {
  key: TSort;
  setKey(val: TSort): void;
};

type HeaderFilters<TSort extends string> = {
  search: HeaderSearchFilters;
  sort: HeaderSortFilters<TSort>;
};

type ArchiveHeaderFilters = HeaderFilters<"newest" | "oldest" | "archived" | "archivedOldest" | "az">;
type DictionaryHeaderFilters = HeaderFilters<"az" | "updated">;

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function isCurrentPage(currentPath: string, href: string) {
  return normalizePath(currentPath) === normalizePath(href);
}

function isActivePath(currentPath: string, href: string) {
  const normalizedHref = normalizePath(href);
  if (normalizedHref === "/") return currentPath === "/";
  return currentPath === normalizedHref || currentPath.startsWith(`${normalizedHref}/`);
}

type BaseProps = {
  siteName: string;
  view: "home" | "faq" | "archive" | "dictionary";
  logoSrc: string;
  discordInviteUrl?: string;
  onLogoClick?(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void;
  onArchiveClick?(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void;
};

type Props =
  | (BaseProps & { view: "home"; filters?: undefined })
  | (BaseProps & { view: "faq"; filters?: undefined })
  | (BaseProps & {
      view: "archive";
      filters?: ArchiveHeaderFilters;
      aiSearchAvailable?: boolean;
      aiSearchApplied?: boolean;
      onAiSearchToggle?: () => void;
      onArchiveSearchFocus?: () => void;
      onArchiveSearchBlur?: () => void;
      archiveSearchFocused?: boolean;
    })
  | (BaseProps & {
      view: "dictionary";
      filters?: DictionaryHeaderFilters;
      aiSearchAvailable?: boolean;
      aiSearchApplied?: boolean;
      onAiSearchToggle?: () => void;
      onDictionarySearchFocus?: () => void;
      onDictionarySearchBlur?: () => void;
      dictionarySearchFocused?: boolean;
    });

export function HeaderBar(props: Props) {
  const pathname = usePathname() ?? "/";
  const currentPath = normalizePath(pathname);
  const { siteName, view, logoSrc, discordInviteUrl, onLogoClick, onArchiveClick } = props;
  const isArchive = view === "archive";
  const isDictionary = view === "dictionary";
  const archiveFilters = isArchive ? props.filters : undefined;
  const dictionaryFilters = isDictionary ? props.filters : undefined;
  const aiSearchAvailable = (isArchive || isDictionary) ? (props.aiSearchAvailable ?? false) : false;
  const aiSearchApplied = (isArchive || isDictionary) ? (props.aiSearchApplied ?? false) : false;
  const handleAiSearchToggle = (isArchive || isDictionary) ? (props.onAiSearchToggle ?? (() => {})) : () => {};
  const handleArchiveSearchFocus = isArchive ? (props.onArchiveSearchFocus ?? (() => {})) : () => {};
  const handleArchiveSearchBlur = isArchive ? (props.onArchiveSearchBlur ?? (() => {})) : () => {};
  const archiveSearchFocused = isArchive ? (props.archiveSearchFocused ?? false) : false;
  const handleDictionarySearchFocus = isDictionary ? (props.onDictionarySearchFocus ?? (() => {})) : () => {};
  const handleDictionarySearchBlur = isDictionary ? (props.onDictionarySearchBlur ?? (() => {})) : () => {};
  const dictionarySearchFocused = isDictionary ? (props.dictionarySearchFocused ?? false) : false;
  const searchValue = archiveFilters?.search.q ?? "";
  const dictionarySearchValue = dictionaryFilters?.search.q ?? "";
  const showAiIndicator = isArchive
    ? aiSearchAvailable && (!!searchValue.trim() || archiveSearchFocused)
    : isDictionary
      ? aiSearchAvailable && (!!dictionarySearchValue.trim() || dictionarySearchFocused)
      : false;
  const handleSearchChange = archiveFilters?.search.setQ ?? (() => {});
  const handleSearchCommit = archiveFilters?.search.commitSearch ?? (() => {});
  const handleDictionarySearchChange = dictionaryFilters?.search.setQ ?? (() => {});
  const handleDictionarySearchCommit = dictionaryFilters?.search.commitSearch ?? (() => {});
  const navLinkBaseClass = "inline-flex items-center px-1 py-2 text-sm font-medium transition-colors";
  const navLinkInactiveClass = "text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white";
  const navLinkActiveClass = "text-gray-900 underline decoration-blue-600 decoration-2 underline-offset-[10px] dark:text-white dark:decoration-blue-400";

  return (
    <header className="top-0 z-20 bg-white/80 backdrop-blur border-b dark:bg-gray-900/80 sm:sticky">
      <div className="mx-auto w-full px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex w-full flex-col gap-2 pb-1 md:flex-row md:flex-wrap md:items-center md:gap-3">
          <div data-site-navigation className="flex w-full items-center md:w-auto md:shrink-0">
            <ForesightPrefetchLink
              href="/"
              onClick={onLogoClick}
              className="mr-[0.3rem] flex items-center gap-[0.5rem] rounded-[0.45rem] px-[0.18rem] py-[0.08rem] hover:bg-[rgba(255,255,255,0.42)] dark:hover:bg-[rgba(89,114,152,0.32)]"
            >
              <Image
                src={logoSrc}
                alt={`${siteName} logo`}
                width={36}
                height={36}
                className="h-9 w-9 rounded-[0.45rem] object-cover"
              />
              <span className="whitespace-nowrap text-[1rem] font-bold tracking-[0.015em] text-[#3e301f] sm:text-[1.08rem] dark:text-[#d7e4f8]">
                {siteName}
              </span>
            </ForesightPrefetchLink>
          </div>

          <div data-site-navigation className="flex w-full min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap pb-1 md:w-auto md:shrink-0 md:gap-4 md:overflow-visible md:pb-0">
            <ForesightPrefetchLink
              href="/"
              aria-current={isCurrentPage(currentPath, "/") ? "page" : undefined}
              className={clsx(
                navLinkBaseClass,
                isActivePath(currentPath, "/")
                  ? navLinkActiveClass
                  : navLinkInactiveClass,
              )}
            >
              Home
            </ForesightPrefetchLink>
            <ForesightPrefetchLink
              href="/archives/"
              aria-current={isCurrentPage(currentPath, "/archives/") ? "page" : undefined}
              className={clsx(
                navLinkBaseClass,
                isActivePath(currentPath, "/archives/")
                  ? navLinkActiveClass
                  : navLinkInactiveClass,
              )}
              beforePrefetch={() => {
                prefetchIndexAndLatestPosts();
              }}
              onClick={onArchiveClick}
            >
              Archive
            </ForesightPrefetchLink>
            <ForesightPrefetchLink
              href="/dictionary/"
              aria-current={isCurrentPage(currentPath, "/dictionary/") ? "page" : undefined}
              className={clsx(
                navLinkBaseClass,
                isActivePath(currentPath, "/dictionary/")
                  ? navLinkActiveClass
                  : navLinkInactiveClass,
              )}
              beforePrefetch={() => prefetchDictionaryIndex()}
            >
              Dictionary
            </ForesightPrefetchLink>
            {discordInviteUrl ? (
              <a
                href={discordInviteUrl}
                target="_blank"
                rel="noreferrer"
                className={clsx(navLinkBaseClass, navLinkInactiveClass)}
              >
                Join Discord
              </a>
            ) : null}
          </div>

          <div className="flex w-full items-center gap-2 md:ml-auto md:flex-1">
            {view === "archive" ? (
              <>
                <div className="relative w-full sm:ml-auto sm:w-full sm:max-w-xl">
                  <input
                    value={searchValue}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onBlur={() => {
                      handleSearchCommit();
                      handleArchiveSearchBlur();
                    }}
                    onFocus={handleArchiveSearchFocus}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearchCommit();
                    }}
                    placeholder="Search posts, codes, tags, authors"
                    className={clsx(
                      "w-full border-b border-gray-300 bg-transparent px-2 py-2 pl-9 text-sm outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:focus:border-blue-400",
                      showAiIndicator && "pr-14",
                    )}
                  />
                  <span className="pointer-events-none absolute left-3 inset-y-0 flex items-center text-gray-400">🔎</span>
                  {showAiIndicator ? (
                    <button
                      type="button"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={handleAiSearchToggle}
                      aria-pressed={aiSearchApplied}
                      title={aiSearchApplied ? "Disable AI search" : "Enable AI search"}
                      className={clsx(
                        "absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition",
                        aiSearchApplied
                          ? "bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                          : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                      )}
                    >
                      AI
                    </button>
                  ) : null}
                </div>
              </>
            ) : view === "dictionary" ? (
              <>
                <div className="relative w-full sm:ml-auto sm:w-full sm:max-w-xl">
                  <input
                    value={dictionarySearchValue}
                    onChange={(e) => handleDictionarySearchChange(e.target.value)}
                    onBlur={() => {
                      handleDictionarySearchCommit();
                      handleDictionarySearchBlur();
                    }}
                    onFocus={handleDictionarySearchFocus}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleDictionarySearchCommit();
                    }}
                    placeholder="Search dictionary terms"
                    className={clsx(
                      "w-full border-b border-gray-300 bg-transparent px-2 py-2 pl-9 text-sm outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:focus:border-blue-400",
                      showAiIndicator && "pr-14",
                    )}
                  />
                  <span className="pointer-events-none absolute left-3 inset-y-0 flex items-center text-gray-400">🔎</span>
                  {showAiIndicator ? (
                    <button
                      type="button"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={handleAiSearchToggle}
                      aria-pressed={aiSearchApplied}
                      title={aiSearchApplied ? "Disable AI search" : "Enable AI search"}
                      className={clsx(
                        "absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition",
                        aiSearchApplied
                          ? "bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                          : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                      )}
                    >
                      AI
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

          </div>
        </div>
      </div>
    </header>
  );
}
