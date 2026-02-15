export type SiteConfig = {
  lfsExtensions: string[];
  siteName: string;
  siteDescription: string;
  pageDescriptions: {
    archives: string;
    dictionary: string;
    dictionaryExampleEntry: string;
  };
  logoSrc: string;
  basePath: string;
  assetPrefix?: string;
  siteOrigin: string;
  siteUrl: string;
  archiveRepo: {
    owner: string;
    repo: string;
    branch: string;
  };
  discordInviteUrl?: string;
  repositoryUrl?: string;
};

const normalizeBasePath = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailing = withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
  return withoutTrailing;
};

// Deployment configuration lives here rather than env variables.
const siteOrigin = "https://mattbatwings.github.io";
// Set to "/viewer" (or "" for root) depending on where the site is hosted.
const basePath = normalizeBasePath("lrs");
const assetPrefix = basePath || undefined;
const siteUrl = `${siteOrigin.replace(/\/+$/, "")}${basePath || ""}`;

export const siteConfig: SiteConfig = {
  siteName: "Logical Redstone Archive",
  siteDescription: "An archive of useful logical redstone devices.",
  pageDescriptions: {
    archives: "Explore an archive of useful logical redstone devices.",
    dictionary: "Living Dictionary",
    dictionaryExampleEntry: "This is an example dictionary entry used for demonstration purposes.",
  },
  logoSrc: `${basePath}/lra.png`,
  basePath,
  assetPrefix,
  siteOrigin,
  siteUrl,
  archiveRepo: {
    owner: "mattbatwings",
    repo: "Logical-Redstone-Archive",
    branch: "main",
  },
  lfsExtensions: ["mp4", "bin", "zip"],
  repositoryUrl: "https://github.com/mattbatwings/Logical-Redstone-Archive",
  discordInviteUrl: "https://discord.gg/r7FmnacNas",
};
