import { notFound } from "next/navigation";
import { ArchiveShell } from "@/components/archive/ArchiveShell";
import { fetchArchiveIndex } from "@/lib/archive";
import { ARCHIVE_PAGE_SIZE, getArchivePageCount } from "@/lib/pagination";
import { disablePagination } from "@/lib/runtimeFlags";
import { Metadata } from "next";
import { siteConfig } from "@/lib/siteConfig";

export const dynamic = "force-static";

type Params = {
  params: { page: string };
};


export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = Number.parseInt((await params).page, 10);

  const description = siteConfig.pageDescriptions.archives;

  return {
    title: `Archives Page ${page} · ${siteConfig.siteName}`,
    description,
    metadataBase: new URL(siteConfig.siteUrl),
    alternates: {
      canonical: `/archives`,
    },
    openGraph: {
      title: `Archives Page ${page} · ${siteConfig.siteName}`,
      description,
      url: `/archives/page/${page}`,
    },
    twitter: {
      title: `Archives Page ${page} · ${siteConfig.siteName}`,
      description
    },
  };
}


export async function generateStaticParams() {
  if (disablePagination) return [];
  const archive = await fetchArchiveIndex();
  const pageCount = getArchivePageCount(archive.posts.length, ARCHIVE_PAGE_SIZE);
  return Array.from({ length: Math.max(0, pageCount) }, (_, i) => ({ page: `${i + 1}` }));
}

export default async function ArchivePagedPage({ params }: Params) {
  const pageNumber = Number.parseInt((await params).page, 10);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return notFound();
  const archive = await fetchArchiveIndex();
  const pageCount = getArchivePageCount(archive.posts.length, ARCHIVE_PAGE_SIZE);
  if (pageNumber > pageCount) return notFound();
  return (
    <ArchiveShell
      initialArchive={archive}
      pageNumber={pageNumber}
      pageSize={ARCHIVE_PAGE_SIZE}
      pageCount={pageCount}
    />
  );
}
