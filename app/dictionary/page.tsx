import { DictionaryShell } from "@/components/dictionary/DictionaryShell";
import { fetchDictionaryIndex } from "@/lib/archive";
import { siteConfig } from "@/lib/siteConfig";
import { Metadata } from "next";

export const dynamic = "force-static";

const description = siteConfig.pageDescriptions.dictionary;

export const metadata: Metadata = {
  title: `Dictionary · ${siteConfig.siteName}`,
  description,
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: `Dictionary · ${siteConfig.siteName}`,
    description,
    url: `/dictionary`,
    images: []
  },
  twitter: {
    card: "summary",
    title: `Dictionary · ${siteConfig.siteName}`,
    description,
    images: []
  },
};

export default async function DictionaryPage() {
  const dictionary = await fetchDictionaryIndex();
  return <DictionaryShell entries={dictionary.entries}/>;
}
