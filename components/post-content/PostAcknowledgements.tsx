import Image from "next/image";
import type { Author, Reference } from "@/lib/types";
import { getAuthorName } from "@/lib/utils/authors";
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
      <ul className="space-y-3">
        {acknowledgements.map((a, i) => {
          const decorated = transformOutputWithReferencesForWebsite(
            a.reason || "",
            authorReferences || [],
            (id) => dictionaryTooltips?.[id],
          );
          const name = getAuthorName(a as Author);
          const handle = a.username && a.username !== name ? a.username : null;
          const initial = name.trim().charAt(0).toUpperCase() || "?";
          const iconURL = (a as { iconURL?: string }).iconURL;
          const url = (a as { url?: string }).url;
          return (
            <li key={i} className="flex gap-3 rounded-xl border p-3 dark:border-gray-800">
              <div className="shrink-0">
                {iconURL ? (
                  <Image src={iconURL} alt={name} className="h-10 w-10 rounded-full object-cover" width={40} height={40} unoptimized />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {initial}
                  </span>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                        {name}
                      </a>
                    ) : (
                      name
                    )}
                  </span>
                  {handle ? <span className="text-xs text-gray-500">@{handle}</span> : null}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <MarkdownText text={decorated} onLinkClick={onLinkClick} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
