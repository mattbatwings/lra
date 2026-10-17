import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostContent } from "@/components/post-content/PostContent";
import { PostNav } from "@/components/archive/PostNav";
import { Footer } from "@/components/layout/Footer";
import { fetchArchiveIndex, fetchDictionaryIndex, fetchPostWithArchive } from "@/lib/archive";
import { siteConfig } from "@/lib/siteConfig";
import { disableArchivePrerender } from "@/lib/runtimeFlags";
import { DEFAULT_GLOBAL_TAGS } from "@/lib/types";
import { submissionRecordToMarkdown } from "@/lib/utils/markdown";
import { getEffectiveStyle } from "@/lib/utils/styles";
import { truncateStringWithEllipsis } from "@/lib/utils/strings";
import { transformOutputWithReferencesForSocials } from "@/lib/utils/references";
import { getPreviewByCode } from "@/lib/previews";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { createArchiveArticleJsonLd } from "@/lib/jsonLd";
import { getAuthorName } from "@/lib/utils/authors";

export const dynamic = "force-static";

type Params = {
  params: { slug: string };
};

export async function generateStaticParams() {
  if (disableArchivePrerender) return [
    { slug: "example-entry" },
  ];
  const archive = await fetchArchiveIndex();
  return archive
    .posts
    // .filter((post) => post.entry.codes[0] !== "US001") // debug
    .map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const payload = await fetchPostWithArchive(slug);
  if (!payload) return { title: "Entry not found" };
  const { archive, data, post: match } = payload;
  if (!data) return { title: "Entry not found" };
  const preview = getPreviewByCode(match.entry.codes[0]);
  const ogImage = preview ? new URL(preview.localPath, siteConfig.siteUrl).toString() : undefined;
  const description = truncateStringWithEllipsis((data.records["description"] ? transformOutputWithReferencesForSocials(submissionRecordToMarkdown(data.records["description"], getEffectiveStyle("description", archive.config.postStyle, data.styles)), data.references) : '') || `Archive entry ${match.entry.codes[0]} from ${match.channel.name}`, 200);
  return {
    title: `${match.entry.name} | ${siteConfig.siteName}`,
    description,
    alternates: {
      canonical: `/archives/${match.slug}/`,
    },
    openGraph: {
      type: "article",
      title: `${match.entry.name} | ${siteConfig.siteName}`,
      description,
      url: `/archives/${match.slug}/`,
      images: ogImage
        ? [
          {
            url: ogImage,
            width: preview?.width,
            height: preview?.height,
            alt: match.entry.name,
          },
        ]
        : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: `${match.entry.name} | ${siteConfig.siteName}`,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const slug = decodeURIComponent((await params).slug);
  const payload = await fetchPostWithArchive(slug);
  if (!payload) return notFound();
  const { archive, post: match, data } = payload;
  const preview = getPreviewByCode(match.entry.codes[0]);
  const description = truncateStringWithEllipsis((data.records["description"] ? transformOutputWithReferencesForSocials(submissionRecordToMarkdown(data.records["description"], getEffectiveStyle("description", archive.config.postStyle, data.styles)), data.references) : '') || `Archive entry ${match.entry.codes[0]} from ${match.channel.name}`, 200);
  const title = `${match.entry.name} | ${siteConfig.siteName}`;
  const authorNames = data.authors?.filter((author) => !author.dontDisplay).map(getAuthorName) ?? [];
  const archivePostJsonLd = createArchiveArticleJsonLd({
    slug: match.slug,
    title,
    description,
    imagePath: preview?.localPath,
    authors: authorNames.length ? authorNames : match.entry.authors,
    tags: data.tags?.map((tag) => tag.name) ?? match.entry.tags,
    publishedAt: data.timestamp ?? data.archivedAt ?? match.entry.archivedAt,
    modifiedAt: data.updatedAt ?? match.entry.updatedAt,
    channelName: match.channel.name,
    categoryName: match.channel.category,
  });
  const globalTags = archive.config.globalTags?.length ? archive.config.globalTags : DEFAULT_GLOBAL_TAGS;
  const dictionary = await fetchDictionaryIndex();
  const dictionaryTooltips: Record<string, string> = {};
  dictionary.entries.forEach((entry) => {
    const summary = entry.index.summary?.trim();
    if (summary) dictionaryTooltips[entry.index.id] = summary;
  });
  return (
    <>
      <PageJsonLd data={archivePostJsonLd} />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-8 lg:px-6">
        <PostNav prefetch={true} />
        <PostContent
          preloadImage={true}
          key={match.entry.id}
          post={match}
          data={data}
          schemaStyles={archive.config.postStyle}
          dictionaryTooltips={dictionaryTooltips}
          globalTags={globalTags}
        />
      </main>
      <Footer />
    </>
  );
}
