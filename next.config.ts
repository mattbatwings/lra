import type { NextConfig } from "next";
import { siteConfig } from "./lib/siteConfig";

const normalizeBasePath = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return undefined;
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailing = withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
  return withoutTrailing || undefined;
};

const basePath = normalizeBasePath(siteConfig.basePath);
const assetPrefix = siteConfig.assetPrefix ? siteConfig.assetPrefix.replace(/\/+$/, "") : basePath;

const nextConfig: NextConfig = {
  /**
   * Allow deploying under a custom sub-path (e.g. /viewer).
   */
  basePath,
  assetPrefix,

  /**
   * Enable static exports.
   *
   * @see https://nextjs.org/docs/app/building-your-application/deploying/static-exports
   */
  output: "export",

  /**
   * Disable server-based image optimization. Next.js does not support
   * dynamic features with static exports.
   *
   * @see https://nextjs.org/docs/pages/api-reference/components/image#unoptimized
   */
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "media.discordapp.net" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },

  /**
   * GitHub Pages prefers folder-style URLs.
   */
  trailingSlash: true,
};

export default nextConfig;
