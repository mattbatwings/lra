import { NextResponse } from "next/server";
import { fetchArchiveIndex } from "@/lib/archive";
import { ARCHIVE_PAGE_SIZE, getArchivePageCount } from "@/lib/pagination";
import { siteConfig } from "@/lib/siteConfig";
import { getEntryArchivedAt, getEntryUpdatedAt } from "@/lib/types";

export const dynamic = "force-static";
export const revalidate = 3600;

type UrlEntry = {
  loc: string;
  lastmod?: string;
};

export async function GET() {
  const origin = siteConfig.siteOrigin.replace(/\/+$/, "");
  const withBasePath = (path: string) => `${siteConfig.basePath || ""}${path}`;
  const urls: UrlEntry[] = [
    { loc: "/" },
    { loc: "/archives" },
    { loc: "/dictionary" },
  ];

  try {
    const archive = await fetchArchiveIndex();
    const pageCount = getArchivePageCount(archive.posts.length, ARCHIVE_PAGE_SIZE);
    for (let i = 1; i <= pageCount; i++) {
      urls.push({ loc: `/archives/page/${i}` });
    }
    archive.posts.forEach((post) => {
      const ts = getEntryUpdatedAt(post.entry) ?? getEntryArchivedAt(post.entry);
      urls.push({
        loc: `/archives/${post.slug}`,
        lastmod: ts ? new Date(ts).toISOString() : undefined,
      });
    });
  } catch {
    // If archive fetch fails, still return a minimal sitemap.
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      ({ loc, lastmod }) =>
        [
          "<url>",
          `<loc>${new URL(withBasePath(loc), `${origin}/`).toString()}</loc>`,
          lastmod ? `<lastmod>${lastmod}</lastmod>` : null,
          "</url>",
        ]
          .filter(Boolean)
          .join(""),
    ),
    "</urlset>",
  ].join("");

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}
