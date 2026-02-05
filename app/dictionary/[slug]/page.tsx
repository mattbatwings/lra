import type { Metadata } from "next";
import { DictionaryShell } from "@/components/dictionary/DictionaryShell";
import { fetchDictionaryEntry, fetchDictionaryIndex } from "@/lib/archive";
import { buildDictionarySlug, findDictionaryEntryBySlug } from "@/lib/dictionary";
import { disableDictionaryPrerender } from "@/lib/runtimeFlags";
import { siteConfig } from "@/lib/siteConfig";
import { truncateStringWithEllipsis } from "@/lib/utils/strings";

export const dynamic = "force-static";

type Params = {
  params: { slug: string };
};

export async function generateStaticParams() {
  if (disableDictionaryPrerender) return [
    { slug: "example-entry" },
  ];
  const dictionary = await fetchDictionaryIndex();
  if (dictionary.entries.length === 0) return [
    { slug: "example-entry" },
  ];

  return dictionary.entries.map((entry) => ({ slug: buildDictionarySlug(entry.index) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const exampleDescription = siteConfig.pageDescriptions.dictionaryExampleEntry;

  if (slug === "example-entry") {
    return {
      title: `Example Entry · ${siteConfig.siteName} Dictionary`,
      description: exampleDescription,
      alternates: {
        canonical: `/dictionary/${slug}`,
      },
      openGraph: {
        type: "article",
        title: `Example Entry · ${siteConfig.siteName} Dictionary`,
        description: exampleDescription,
        url: `/dictionary/${slug}`,
      },
      twitter: {
        card: "summary",
        title: `Example Entry · ${siteConfig.siteName} Dictionary`,
        description: exampleDescription,
      },
    };
  } 
  
  const dictionary = await fetchDictionaryIndex();
  const match = findDictionaryEntryBySlug(dictionary.config.entries, slug);
  if (!match) {
    return { title: "Entry not found" };
  }

  const description =
    truncateStringWithEllipsis(match.summary?.trim() ||
      `Dictionary entry ${match.id} from ${siteConfig.siteName}`, 200);
  const title = `${match.terms?.[0] ?? match.id} | ${siteConfig.siteName} Dictionary`;

  return {
    title,
    description,
    alternates: {
      canonical: `/dictionary/${slug}`,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/dictionary/${slug}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function DictionaryEntryPage({ params }: Params) {
  const dictionary = await fetchDictionaryIndex();
  const slug = decodeURIComponent((await params).slug);
  const match = findDictionaryEntryBySlug(dictionary.config.entries, slug);
  if (!match) return <DictionaryShell entries={dictionary.entries} />;

  const data = await fetchDictionaryEntry(match.id);
  return (
    <DictionaryShell
      entries={dictionary.entries}
      initialActiveEntry={{ index: match, data }}
    />
  );
}
