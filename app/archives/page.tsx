import { ArchiveShell } from "@/components/archive/ArchiveShell";
import { fetchArchiveIndex } from "@/lib/archive";
import { ARCHIVE_PAGE_SIZE, getArchivePageCount } from "@/lib/pagination";
import { disablePagination } from "@/lib/runtimeFlags";
import { siteConfig } from "@/lib/siteConfig";
import { Metadata } from "next";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { createCollectionPageJsonLd } from "@/lib/jsonLd";


export const dynamic = "force-static";

const archivesTitle = `Archives · ${siteConfig.siteName}`;
const description = siteConfig.pageDescriptions.archives;

export const metadata: Metadata = {
  title: archivesTitle,
  description,
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: archivesTitle,
    description,
    url: `/archives/`,
  },
  twitter: {
    title: archivesTitle,
    description,
  },
};

export default async function ArchivePage() {
  const archive = await fetchArchiveIndex();
  const pageCount = disablePagination ? 1 : getArchivePageCount(archive.posts.length, ARCHIVE_PAGE_SIZE);
  const pagePosts = archive.posts.slice(0, ARCHIVE_PAGE_SIZE);
  const archivesJsonLd = createCollectionPageJsonLd({
    path: "/archives/",
    title: archivesTitle,
    description,
    numberOfItems: archive.posts.length,
    items: pagePosts.map((post) => ({
      name: post.entry.name,
      url: `/archives/${post.slug}/`,
      description: `Archive entry from ${post.channel.name}.`,
      type: "TechArticle",
      dateModified: post.entry.updatedAt,
      keywords: post.entry.tags,
      extra: {
        articleSection: post.channel.name,
      },
    })),
  });
  return (
    <>
      <PageJsonLd data={archivesJsonLd} />
      <ArchiveShell
        initialArchive={archive}
        pageNumber={0}
        pageSize={ARCHIVE_PAGE_SIZE}
        pageCount={pageCount}
      />
    </>
  );
}
