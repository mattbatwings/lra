import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/siteConfig";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const origin = siteConfig.siteOrigin.replace(/\/+$/, "");
  const sitemapUrl = new URL(`${siteConfig.basePath || ""}/sitemap.xml`, `${origin}/`).toString();
  const body = [`User-agent: *`, `Allow: /`, `Host: ${origin}`, `Sitemap: ${sitemapUrl}`].join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
