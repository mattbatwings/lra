import { DictionaryShell } from "@/components/dictionary/DictionaryShell";
import { fetchDictionaryIndex } from "@/lib/archive";
import { siteConfig } from "@/lib/siteConfig";
import { Metadata } from "next";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { buildDictionarySlug } from "@/lib/dictionary";
import { createCollectionPageJsonLd } from "@/lib/jsonLd";

export const dynamic = "force-static";

const dictionaryTitle = `Dictionary · ${siteConfig.siteName}`;
const dictionaryDescription = siteConfig.pageDescriptions.dictionary;

export const metadata: Metadata = {
  title: dictionaryTitle,
  description: dictionaryDescription,
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: dictionaryTitle,
    description: dictionaryDescription,
    url: `/dictionary/`,
    images: []
  },
  twitter: {
    card: "summary",
    title: dictionaryTitle,
    description: dictionaryDescription,
    images: []
  },
};

export default async function DictionaryPage() {
  const dictionary = await fetchDictionaryIndex();
  const dictionaryJsonLd = createCollectionPageJsonLd({
    path: "/dictionary/",
    title: dictionaryTitle,
    description: dictionaryDescription,
    numberOfItems: dictionary.entries.length,
    items: dictionary.entries.map((entry) => ({
      name: entry.index.terms[0] || entry.index.id,
      url: `/dictionary/${buildDictionarySlug(entry.index)}/`,
      description: entry.index.summary,
      type: "DefinedTerm",
      dateModified: entry.index.updatedAt,
      extra: {
        termCode: entry.index.id,
        ...(entry.index.terms.length > 1 ? { alternateName: entry.index.terms.slice(1) } : {}),
      },
    })),
  });
  return (
    <>
      <PageJsonLd data={dictionaryJsonLd} />
      <DictionaryShell entries={dictionary.entries} />
    </>
  );
}
