import Image from "next/image";
import type { Author, Reference } from "@/lib/types";
import { getAuthorIconURL, getAuthorName } from "@/lib/utils/authors";
import { transformOutputWithReferencesForWebsite } from "@/lib/utils/references";
import { MarkdownText } from "../ui/LinkHelpers";

type Props = {
  acknowledgements: Array<Partial<Author> & { reason?: string }>;
  authorReferences?: Reference[];
  dictionaryTooltips?: Record<string, string>;
  onLinkClick(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void;
};

export function PostAcknowledgements({
  acknowledgements,
  authorReferences,
  dictionaryTooltips,
  onLinkClick,
}: Props) {
  if (!acknowledgements.length) return null;

  return (
    <div>
      <h4 className="mb-2 text-xl font-semibold tracking-wide text-gray-600 dark:text-gray-300">Acknowledgements</h4>
      <ul className="space-y-2 text-sm">
        {acknowledgements.map((a, i) => {
          const author = a as Author;
          const decorated = transformOutputWithReferencesForWebsite(
            a.reason || "",
            authorReferences || [],
            (id) => dictionaryTooltips?.[id],
          );
          const name = getAuthorName(author);
          const iconURL = getAuthorIconURL(author);
          const handle = a.username && a.username !== name ? a.username : null;
          const url = (a as { url?: string }).url;
          return (
            <li key={i} className="grid gap-2 sm:grid-cols-[max-content_1fr] sm:items-start sm:gap-4">
              <div className="flex min-w-0 items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                {iconURL ? (
                  <Image src={iconURL} alt="" className="h-6 w-6 rounded-full object-cover" width={24} height={24} unoptimized />
                ) : (
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                )}
                <span className="whitespace-nowrap">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                      {name}
                    </a>
                  ) : (
                    name
                  )}
                </span>
                {handle ? <span className="shrink-0 text-xs font-normal text-gray-500">@{handle}</span> : null}
              </div>
              <div className="min-w-0 text-gray-700 dark:text-gray-300">
                <MarkdownText text={decorated} onLinkClick={onLinkClick} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
